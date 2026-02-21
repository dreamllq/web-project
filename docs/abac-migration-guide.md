# ABAC Developer Migration Guide

**Version:** 1.0
**Last Updated:** 2026-02-21
**Audience:** Developers working on the backend

---

## Table of Contents

1. [Overview](#1-overview)
2. [Quick Start](#2-quick-start)
3. [Creating ABAC Policies](#3-creating-abac-policies)
4. [Testing Permissions](#4-testing-permissions)
5. [FAQ](#5-faq)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Overview

### What is ABAC?

ABAC (Attribute-Based Access Control) is an authorization model where access decisions are based on attributes of the subject, resource, action, and environment. Unlike RBAC which only considers roles, ABAC allows fine-grained control using any available attributes.

### Key Concepts

| Term       | Description                                  | Example                          |
| ---------- | -------------------------------------------- | -------------------------------- |
| Subject    | Who is requesting access                     | `role:admin`, `user:123`         |
| Resource   | What is being accessed                       | `user`, `policy`, `audit`        |
| Action     | What operation is being performed            | `create`, `read`, `delete`       |
| Effect     | Whether to allow or deny                     | `allow`, `deny`                  |
| Conditions | Optional rules for dynamic decisions         | Time-based, ownership checks     |
| Priority   | Higher priority policies override lower ones | 1000 (super admin), 50 (default) |

### Why We Migrated

1. **Fine-grained control**: RBAC only supports role-based checks, while ABAC supports complex rules like "users can only edit their own records"
2. **Dynamic policies**: Permissions can change without code changes
3. **Scalability**: Adding new access patterns doesn't require code changes
4. **Auditability**: All access decisions are logged with full context

### Migration Status

The system uses a hybrid approach during transition:

```
Request → PermissionGuard
              ↓
         ABAC Policy Check (primary)
              ↓ (no matching policy)
         RBAC Permission Check (fallback)
              ↓
         Allow/Deny
```

---

## 2. Quick Start

### How Permissions Work Now

Use the `@RequirePermission` decorator in your controllers:

```typescript
import { RequirePermission } from '../policy/decorators/require-permission.decorator';

@Controller('users')
@UseGuards(PermissionGuard)
export class UserController {
  @Get(':id')
  @RequirePermission('user', 'read')
  async getUser(@Param('id') id: string) {
    // Only users with permission to read users can access
  }

  @Post()
  @RequirePermission('user', 'create')
  async createUser(@Body() dto: CreateUserDto) {
    // Only users with permission to create users can access
  }
}
```

### Available Resources and Actions

| Resource     | Actions                      |
| ------------ | ---------------------------- |
| `user`       | create, read, update, delete |
| `role`       | create, read, update, delete |
| `permission` | create, read, update, delete |
| `policy`     | create, read, update, delete |
| `audit`      | read                         |

### Checking Permissions Programmatically

```typescript
import { PolicyEvaluatorService } from '../policy/services/policy-evaluator.service';

@Injectable()
export class MyService {
  constructor(private readonly policyEvaluator: PolicyEvaluatorService) {}

  async checkAccess(userId: string, resource: string, action: string): Promise<boolean> {
    const result = await this.policyEvaluator.evaluate({
      subject: `user:${userId}`,
      resource,
      action,
      context: {}, // Optional additional context
    });

    return result.allowed;
  }
}
```

---

## 3. Creating ABAC Policies

### Policy Structure

```typescript
interface Policy {
  name: string; // Human-readable name
  effect: 'allow' | 'deny';
  subject: string; // Who this applies to
  resource: string; // What resource (or '*' for all)
  action: string; // What action (or '*' for all)
  conditions: any; // Optional conditions (null for none)
  priority: number; // Higher = evaluated first
  enabled: boolean; // Whether policy is active
}
```

### Subject Patterns

| Pattern       | Description         | Example Use Case    |
| ------------- | ------------------- | ------------------- |
| `role:{name}` | Match by role       | All admins          |
| `user:{id}`   | Match specific user | Super admin account |
| `*`           | Match anyone        | Public read access  |

### Resource and Action Patterns

| Pattern | Description       |
| ------- | ----------------- |
| `user`  | Specific resource |
| `*`     | All resources     |
| `read`  | Specific action   |
| `*`     | All actions       |

### Common Policy Templates

#### Admin Role - Full Access

```json
{
  "name": "Admin - Full Access",
  "effect": "allow",
  "subject": "role:admin",
  "resource": "*",
  "action": "*",
  "conditions": null,
  "priority": 100,
  "enabled": true
}
```

#### Read-Only Role

```json
{
  "name": "ReadOnly - Read All",
  "effect": "allow",
  "subject": "role:readonly",
  "resource": "*",
  "action": "read",
  "conditions": null,
  "priority": 50,
  "enabled": true
}
```

#### User Self-Access (with conditions)

```json
{
  "name": "User - Update Own Profile",
  "effect": "allow",
  "subject": "role:user",
  "resource": "user",
  "action": "update",
  "conditions": {
    "type": "comparison",
    "operator": "equals",
    "field": "resource.owner_id",
    "value": "subject.id"
  },
  "priority": 50,
  "enabled": true
}
```

#### Super Admin (highest priority)

```json
{
  "name": "Super Admin - Full Access",
  "effect": "allow",
  "subject": "role:super_admin",
  "resource": "*",
  "action": "*",
  "conditions": null,
  "priority": 1000,
  "enabled": true
}
```

### Priority Guidelines

| Role Type   | Priority Range | Description                     |
| ----------- | -------------- | ------------------------------- |
| Super Admin | 1000           | Highest priority, overrides all |
| Admin       | 100-999        | High priority for admin roles   |
| Standard    | 50-99          | Default for custom roles        |
| Restricted  | 1-49           | Low priority, may be overridden |

### Creating Policies via API

```bash
curl -X POST /api/v1/policy \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Manager - Read Users",
    "effect": "allow",
    "subject": "role:manager",
    "resource": "user",
    "action": "read",
    "conditions": null,
    "priority": 75,
    "enabled": true
  }'
```

### Creating Policies Programmatically

```typescript
import { PolicyService } from '../policy/services/policy.service';

@Injectable()
export class PolicySetupService {
  constructor(private readonly policyService: PolicyService) {}

  async createDefaultPolicies() {
    await this.policyService.create({
      name: 'Editor - Manage Content',
      effect: PolicyEffect.ALLOW,
      subject: 'role:editor',
      resource: 'content',
      action: '*',
      conditions: null,
      priority: 60,
      enabled: true,
    });
  }
}
```

---

## 4. Testing Permissions

### Using the Policy Evaluation API

Test if a user has permission to perform an action:

```bash
curl -X POST /api/v1/policy/evaluate \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "user",
    "action": "delete"
  }'
```

Response:

```json
{
  "allowed": true,
  "reason": "Matched policy: Admin - Full Access",
  "matchedPolicy": {
    "name": "Admin - Full Access",
    "priority": 100
  }
}
```

### Running the Audit Tool

Check ABAC coverage against RBAC permissions:

```bash
pnpm run tools:audit-permissions
```

This outputs:

- Coverage percentage
- Missing policies
- Redundant policies
- Migration readiness status

### Unit Testing Policies

```typescript
describe('PolicyEvaluator', () => {
  let evaluator: PolicyEvaluatorService;

  beforeEach(async () => {
    // Setup with test policies
  });

  it('should allow admin to delete any user', async () => {
    const result = await evaluator.evaluate({
      subject: 'role:admin',
      resource: 'user',
      action: 'delete',
      context: {},
    });

    expect(result.allowed).toBe(true);
  });

  it('should deny regular user from deleting other users', async () => {
    const result = await evaluator.evaluate({
      subject: 'role:user',
      resource: 'user',
      action: 'delete',
      context: {},
    });

    expect(result.allowed).toBe(false);
  });

  it('should allow user to update own profile with condition', async () => {
    const result = await evaluator.evaluate({
      subject: 'user:123',
      resource: 'user',
      action: 'update',
      context: {
        subject: { id: '123' },
        resource: { owner_id: '123' },
      },
    });

    expect(result.allowed).toBe(true);
  });
});
```

### Integration Testing with Guards

```typescript
describe('UserController (e2e)', () => {
  it('should return 403 when user lacks permission', () => {
    return request(app.getHttpServer())
      .delete('/users/123')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('should succeed when user has permission', () => {
    return request(app.getHttpServer())
      .delete('/users/123')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
```

---

## 5. FAQ

### Q: Do I need to remove RoleGuard from my code?

**A:** No. RoleGuard is kept for backward compatibility and edge cases. PermissionGuard is the primary authorization mechanism and supports both ABAC and RBAC.

### Q: What happens if there's no matching ABAC policy?

**A:** The system falls back to RBAC permission checks. If no RBAC permission matches either, access is denied.

### Q: Can I use both RoleGuard and PermissionGuard?

**A:** Yes, but PermissionGuard is recommended for new code. RoleGuard only checks role membership, while PermissionGuard checks actual capabilities.

### Q: How do wildcard policies work?

**A:** A policy with `resource: "*"` and `action: "*"` grants access to everything. Use with caution and high priority only for trusted roles.

### Q: What's the difference between `role:admin` and `user:123` subjects?

**A:**

- `role:admin`: Matches any user who has the admin role
- `user:123`: Matches only the specific user with ID 123

### Q: How do I debug permission issues?

**A:**

1. Use the policy evaluation API to test specific scenarios
2. Check the audit logs for denied access attempts
3. Run `pnpm run tools:audit-permissions` to check coverage

### Q: Can conditions reference external data?

**A:** Currently, conditions can reference attributes from the subject and resource context passed during evaluation. External API calls in conditions are not supported.

### Q: How often should I audit my policies?

**A:** Run the audit tool after:

- Adding new API endpoints
- Creating new roles
- Modifying existing permissions
- Before releasing to production

---

## 6. Troubleshooting

### Permission Denied When It Shouldn't Be

**Symptoms:** User with correct role gets 403 Forbidden

**Possible Causes:**

1. **Policy not created**: Check if the ABAC policy exists

   ```bash
   pnpm run tools:audit-permissions
   ```

2. **Policy is disabled**: Verify `enabled: true` in policy

3. **Wrong subject format**: Use `role:name` not just the role name

4. **Priority too low**: Higher priority policies might be denying access

**Solution:**

```bash
# Check current policies
curl /api/v1/policy -H "Authorization: Bearer {token}"

# Test evaluation
curl -X POST /api/v1/policy/evaluate \
  -H "Authorization: Bearer {token}" \
  -d '{"resource": "user", "action": "read"}'
```

### RBAC Fallback Not Working

**Symptoms:** ABAC miss doesn't fall back to RBAC

**Possible Causes:**

1. **No RBAC permissions assigned**: User's role has no permissions
2. **Permission name mismatch**: RBAC uses `resource:action` format

**Solution:**

```bash
# Check user's role and permissions
npx tsx tools/query-roles.ts
```

### Conditions Not Evaluating Correctly

**Symptoms:** Policy with conditions never matches

**Possible Causes:**

1. **Missing context**: Context object doesn't include required fields
2. **Wrong field path**: `resource.owner_id` vs `resource.ownerId`

**Solution:**

```typescript
// Ensure context includes required fields
const result = await evaluator.evaluate({
  subject: 'user:123',
  resource: 'user',
  action: 'update',
  context: {
    subject: { id: '123' },
    resource: { owner_id: '123' }, // Must match condition field path
  },
});
```

### Slow Permission Checks

**Symptoms:** API responses are slow after ABAC migration

**Possible Causes:**

1. **Too many policies**: Large number of policies to evaluate
2. **Complex conditions**: Expensive condition evaluation

**Solutions:**

1. Use wildcard policies for high-trust roles to short-circuit evaluation
2. Set appropriate priorities to match high-priority policies first
3. Consider caching for frequently accessed resources

### Migration Coverage Shows 0%

**Symptoms:** Audit tool shows 0% coverage after creating policies

**Possible Causes:**

1. **Policy resource/action mismatch**: Must exactly match RBAC permission format
2. **RBAC permissions not synced**: Database has stale RBAC data

**Solution:**

```bash
# Re-query RBAC permissions
npx tsx tools/query-roles.ts

# Re-run audit
pnpm run tools:audit-permissions
```

---

## Related Documents

- [RBAC to ABAC Mapping](./rbac-abac-mapping.md) - Detailed policy templates
- [Permission Audit Report](./permission-audit-report.md) - Current coverage status
- [RoleGuard Decision](./role-guard-decision.md) - Why RoleGuard is kept

---

## Getting Help

1. Check the troubleshooting section above
2. Review the audit report for coverage gaps
3. Test with the policy evaluation API
4. Check backend logs for detailed error messages

---

_Guide created for RBAC to ABAC migration (Task 5.3)_
