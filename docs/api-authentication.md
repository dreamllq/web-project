# API Authentication and Authorization

This document describes the authentication and authorization system for the API.

## Authentication

All API endpoints (except public ones) require JWT authentication. Include the access token in the `Authorization` header:

```
Authorization: Bearer <your_access_token>
```

### Getting a Token

1. **Login**: `POST /api/auth/login` with username and password
2. **OAuth**: Use OAuth providers (WeChat, DingTalk, etc.)
3. **Refresh**: `POST /api/auth/refresh` with refresh token

## Authorization (ABAC)

The API uses **Attribute-Based Access Control (ABAC)** for authorization. Permissions are evaluated based on policies that consider user attributes, resource attributes, and environmental conditions.

### How Authorization Works

1. Endpoints protected with `@RequirePermission(resource, action)` require specific permissions
2. The `PermissionGuard` evaluates ABAC policies to determine access
3. Access is granted if any matching policy allows the action

### USE_ABAC_ONLY Feature Flag

The `USE_ABAC_ONLY` environment variable controls the authorization behavior:

| Value   | Behavior                                                 |
| ------- | -------------------------------------------------------- |
| `true`  | ABAC only. Permissions checked solely via ABAC policies. |
| `false` | ABAC first, then RBAC fallback if ABAC denies. (Default) |

Set in your environment:

```bash
USE_ABAC_ONLY=true
```

> **Note**: Production deployments should use `USE_ABAC_ONLY=true` after ABAC policies are configured.

### Permission Endpoints Summary

Protected endpoints require permissions in the format `resource:action`. The following table lists the main resources and their actions:

| Resource     | Actions                      | Description            |
| ------------ | ---------------------------- | ---------------------- |
| `user`       | create, read, update, delete | User management        |
| `role`       | create, read, update, delete | Role management        |
| `permission` | create, read, update, delete | Permission management  |
| `policy`     | create, read, update, delete | ABAC policy management |
| `audit-log`  | read                         | Audit log access       |

### Using @RequirePermission Decorator

Protect controller methods with the `@RequirePermission` decorator:

```typescript
import { RequirePermission } from '../policy/decorators/require-permission.decorator';
import { PermissionGuard } from '../policy/guards/permission.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UsersController {
  @Get()
  @RequirePermission('user', 'read')
  async findAll() {
    // Only users with user:read permission can access
  }
}
```

### ABAC Policy Structure

ABAC policies define who can do what on which resources:

```typescript
interface Policy {
  name: string; // Policy name for identification
  effect: 'allow' | 'deny'; // Grant or deny access
  subject: string; // Who: 'user:id', 'role:admin', etc.
  resource: string; // What: 'user', 'policy', '*' for all
  action: string; // How: 'read', 'create', '*' for all
  conditions?: object; // Optional conditions (time, IP, etc.)
  priority: number; // Higher = evaluated first
  enabled: boolean; // Active or not
}
```

### Role-Based Policies

Roles from RBAC are used as ABAC subject attributes. A policy with `subject: 'role:admin'` matches any user with the `admin` role.

Example policies:

```json
{
  "name": "Super Admin - Full Access",
  "effect": "allow",
  "subject": "role:super_admin",
  "resource": "*",
  "action": "*",
  "priority": 1000,
  "enabled": true
}
```

```json
{
  "name": "User Manager - Read Users",
  "effect": "allow",
  "subject": "role:user_manager",
  "resource": "user",
  "action": "read",
  "priority": 100,
  "enabled": true
}
```

### Checking Permissions Programmatically

Use the policy check endpoint to verify permissions:

```bash
# Check single permission
GET /api/policies/check/permission?resource=user&action=read

# Bulk check multiple permissions
POST /api/policies/check/bulk
Content-Type: application/json

[
  { "resource": "user", "action": "read" },
  { "resource": "policy", "action": "create" }
]
```

Response:

```json
{
  "allowed": true,
  "resource": "user",
  "action": "read"
}
```

## Error Responses

### 401 Unauthorized

Missing or invalid authentication token.

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 403 Forbidden

Authenticated but lacking required permission.

```json
{
  "statusCode": 403,
  "message": "You do not have permission to read on user"
}
```

## Related Documentation

- **RBAC to ABAC Mapping**: `docs/rbac-abac-mapping.md`
- **Permission Audit Report**: `docs/permission-audit-report.md`
- **RoleGuard Decision**: `docs/role-guard-decision.md`
- **Migration Guide**: `docs/abac-migration-guide.md` (if available)

## Swagger/OpenAPI

All protected endpoints are marked with `@ApiBearerAuth()` in Swagger. When testing via Swagger UI:

1. Click the "Authorize" button
2. Enter your JWT token (without "Bearer " prefix)
3. Swagger will include the token in requests

Permission requirements are documented in each endpoint's description.
