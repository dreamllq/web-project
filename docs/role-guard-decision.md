# RoleGuard Handling Strategy for ABAC Migration

**Date**: 2026-02-21
**Status**: Decision Document
**Related**: ABAC Migration Plan

---

## Executive Summary

**Recommendation**: **Keep RoleGuard** (no immediate action required)

RoleGuard is registered but currently **not actively used** in any controllers. The `@RequireRole` decorator exists but has no production usage. PermissionGuard with `@RequirePermission` is the primary authorization mechanism and already supports both ABAC and RBAC.

---

## 1. Analysis

### 1.1 Current Usage

| File                                          | Usage Type                     |
| --------------------------------------------- | ------------------------------ |
| `policy/guards/role.guard.ts`                 | Guard implementation           |
| `policy/decorators/require-role.decorator.ts` | Decorator definition           |
| `policy/policy.module.ts`                     | Provider registration & export |

**Active Controller Usage**: **None found**

A codebase search for `@RequireRole` found only:

- Documentation examples in the decorator/guard files
- No actual usage in any controller endpoints

### 1.2 RoleGuard Implementation

```typescript
@Injectable()
export class RoleGuard implements CanActivate {
  // Uses RoleService.hasRole(userId, roleName)
  // Checks if user has ANY of the required roles
  // Pure RBAC - no ABAC support
}
```

**Characteristics**:

- Checks role membership via `RoleService.hasRole()`
- Supports multiple roles (OR logic - any match passes)
- Pure RBAC approach
- Returns 403 Forbidden on failure

### 1.3 Comparison: RoleGuard vs PermissionGuard

| Aspect        | RoleGuard               | PermissionGuard                            |
| ------------- | ----------------------- | ------------------------------------------ |
| Decorator     | `@RequireRole('admin')` | `@RequirePermission('resource', 'action')` |
| Check Type    | Role membership         | Permission (resource:action)               |
| ABAC Support  | No                      | Yes (primary)                              |
| RBAC Fallback | N/A (is RBAC)           | Yes (secondary)                            |
| Usage         | None                    | Primary authorization                      |
| Complexity    | Simple                  | More powerful                              |

### 1.4 PermissionGuard Flow

```
Request → PermissionGuard
              ↓
         ABAC Policy Check (PolicyEvaluator)
              ↓ (fail)
         RBAC Permission Check (RoleService)
              ↓ (pass/fail)
         Allow/Deny
```

PermissionGuard already provides a superset of RoleGuard functionality.

---

## 2. Recommendation

### Decision: **Keep RoleGuard (No Action Required)**

**Rationale**:

1. **No Migration Needed**: RoleGuard has no active usage, so there's nothing to migrate

2. **Minimal Maintenance Burden**: The guard is simple (75 lines) and stable

3. **Future Flexibility**: RoleGuard may be useful for:
   - Simple admin-only endpoints where role check is semantically clearer
   - Endpoints that should bypass ABAC entirely
   - Backward compatibility if needed

4. **Out of Scope**: Full migration to ABAC-only is not a current priority

### Alternative Options Considered

| Option              | Pros                               | Cons                                                         | Decision     |
| ------------------- | ---------------------------------- | ------------------------------------------------------------ | ------------ |
| **Deprecate**       | Signal intent to remove            | Adds warning noise for unused code                           | Rejected     |
| **Migrate to ABAC** | Single authorization model         | No usage to migrate; creates policies for non-existent needs | Rejected     |
| **Keep (Current)**  | No work needed; future flexibility | Slight code overhead                                         | **Accepted** |

---

## 3. Rationale

### Why Not Migrate to ABAC?

1. **No Usage**: Cannot migrate what isn't used
2. **Semantic Simplicity**: `@RequireRole('admin')` is clearer than creating an ABAC policy for the same check
3. **Different Use Cases**:
   - RoleGuard: "User must have role X" (identity-based)
   - PermissionGuard: "User can do action Y on resource Z" (capability-based)

### ABAC Role Modeling (If Needed Later)

If RoleGuard usage grows and migration becomes desirable, roles can be modeled in ABAC:

```typescript
// Policy for role-based access
{
  subject: "role:admin",
  resource: "*",
  action: "*",
  effect: "allow"
}

// Policy evaluator would check:
// - Direct permissions
// - Role-based permissions via "role:xxx" subject patterns
```

---

## 4. Migration Path (Future Reference)

If RoleGuard needs to be deprecated in the future:

### Phase 1: Audit

- [ ] Identify all `@RequireRole` usages
- [ ] Document the role requirements for each endpoint

### Phase 2: Create ABAC Policies

- [ ] Create policies like `subject: "role:admin"` for each role
- [ ] Add role-checking capability to PolicyEvaluatorService

### Phase 3: Replace Usages

- [ ] Replace `@RequireRole('admin')` with `@RequirePermission('role', 'admin')`
- [ ] Or create resource-specific policies for each endpoint

### Phase 4: Deprecate

- [ ] Add `@deprecated` JSDoc to RoleGuard and @RequireRole
- [ ] Remove from policy.module.ts exports
- [ ] Delete files after transition period

---

## 5. Conclusion

| Item            | Status                            |
| --------------- | --------------------------------- |
| RoleGuard       | Keep (no changes)                 |
| @RequireRole    | Keep (no changes)                 |
| PermissionGuard | Primary authorization (unchanged) |
| Migration       | Not required - no active usage    |

**Next Steps**: None required. Focus ABAC migration efforts on PermissionGuard enhancements.

---

## Appendix: Code References

- Guard: `apps/backend/src/policy/guards/role.guard.ts`
- Decorator: `apps/backend/src/policy/decorators/require-role.decorator.ts`
- Module: `apps/backend/src/policy/policy.module.ts`
- PermissionGuard: `apps/backend/src/policy/guards/permission.guard.ts`
