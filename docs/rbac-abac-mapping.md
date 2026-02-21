# RBAC → ABAC Mapping Document

**Generated:** 2026-02-21
**Purpose:** Document all RBAC roles and their corresponding ABAC policy templates for migration planning

---

## Executive Summary

This document maps existing RBAC (Role-Based Access Control) roles to their equivalent ABAC (Attribute-Based Access Control) policy templates. Each role's permissions are translated into ABAC policies using the `subject: "role:{roleName}"` pattern.

### Current State

| Metric                 | Value |
| ---------------------- | ----- |
| Total Roles            | 3     |
| Total RBAC Permissions | 17    |
| ABAC Policies Required | 21    |

### Role Categories

| Category     | Roles           | Description        |
| ------------ | --------------- | ------------------ |
| System Admin | `super_admin`   | Full system access |
| Custom       | `111`, `啊啊啊` | User-defined roles |

---

## Role Mappings

### 1. super_admin

**Description:** Super administrator with full access

**Type:** System Role (`is_super_admin: true`)

#### RBAC Permissions

| Permission          | Resource   | Action | Description               |
| ------------------- | ---------- | ------ | ------------------------- |
| `user:create`       | user       | create | Create new users          |
| `user:read`         | user       | read   | View user details         |
| `user:update`       | user       | update | Update user information   |
| `user:delete`       | user       | delete | Delete users              |
| `role:create`       | role       | create | Create new roles          |
| `role:read`         | role       | read   | View role details         |
| `role:update`       | role       | update | Update role information   |
| `role:delete`       | role       | delete | Delete roles              |
| `permission:create` | permission | create | Create new permissions    |
| `permission:read`   | permission | read   | View permission details   |
| `permission:update` | permission | update | Update permissions        |
| `permission:delete` | permission | delete | Delete permissions        |
| `policy:create`     | policy     | create | Create new policies       |
| `policy:read`       | policy     | read   | View policy details       |
| `policy:update`     | policy     | update | Update policy information |
| `policy:delete`     | policy     | delete | Delete policies           |
| `audit:read`        | audit      | read   | View audit logs           |

#### ABAC Policy Templates

**Option A: Single Wildcard Policy (Recommended for super_admin)**

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

**Option B: Granular Policies (One per permission)**

```json
[
  {
    "name": "Super Admin - Create Users",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "user",
    "action": "create",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Read Users",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "user",
    "action": "read",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Update Users",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "user",
    "action": "update",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Delete Users",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "user",
    "action": "delete",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Create Roles",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "role",
    "action": "create",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Read Roles",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "role",
    "action": "read",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Update Roles",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "role",
    "action": "update",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Delete Roles",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "role",
    "action": "delete",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Create Permissions",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "permission",
    "action": "create",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Read Permissions",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "permission",
    "action": "read",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Update Permissions",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "permission",
    "action": "update",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Delete Permissions",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "permission",
    "action": "delete",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Create Policies",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "policy",
    "action": "create",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Read Policies",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "policy",
    "action": "read",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Update Policies",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "policy",
    "action": "update",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Delete Policies",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "policy",
    "action": "delete",
    "priority": 1000,
    "enabled": true
  },
  {
    "name": "Super Admin - Read Audit Logs",
    "effect": "allow",
    "subject": "role:super_admin",
    "resource": "audit",
    "action": "read",
    "priority": 1000,
    "enabled": true
  }
]
```

---

### 2. 111

**Description:** 22

**Type:** Custom Role (`is_super_admin: false`)

#### RBAC Permissions

| Permission          | Resource   | Action | Description            |
| ------------------- | ---------- | ------ | ---------------------- |
| `audit:read`        | audit      | read   | View audit logs        |
| `permission:create` | permission | create | Create new permissions |

#### ABAC Policy Templates

```json
[
  {
    "name": "Role: 111 - Read Audit Logs",
    "effect": "allow",
    "subject": "role:111",
    "resource": "audit",
    "action": "read",
    "priority": 50,
    "enabled": true
  },
  {
    "name": "Role: 111 - Create Permissions",
    "effect": "allow",
    "subject": "role:111",
    "resource": "permission",
    "action": "create",
    "priority": 50,
    "enabled": true
  }
]
```

---

### 3. 啊啊啊

**Description:** 哇哇

**Type:** Custom Role (`is_super_admin: false`)

#### RBAC Permissions

| Permission          | Resource   | Action | Description            |
| ------------------- | ---------- | ------ | ---------------------- |
| `permission:create` | permission | create | Create new permissions |
| `permission:delete` | permission | delete | Delete permissions     |

#### ABAC Policy Templates

```json
[
  {
    "name": "Role: 啊啊啊 - Create Permissions",
    "effect": "allow",
    "subject": "role:啊啊啊",
    "resource": "permission",
    "action": "create",
    "priority": 50,
    "enabled": true
  },
  {
    "name": "Role: 啊啊啊 - Delete Permissions",
    "effect": "allow",
    "subject": "role:啊啊啊",
    "resource": "permission",
    "action": "delete",
    "priority": 50,
    "enabled": true
  }
]
```

---

## Standard Role Templates (Future Reference)

The following templates are provided for common role patterns that may be created in the future.

### Admin Role Template

```json
{
  "name": "Admin - {resource}:{action}",
  "effect": "allow",
  "subject": "role:admin",
  "resource": "{resource}",
  "action": "{action}",
  "priority": 100,
  "enabled": true
}
```

### Read-Only Role Template

```json
{
  "name": "ReadOnly - {resource}:read",
  "effect": "allow",
  "subject": "role:readonly",
  "resource": "{resource}",
  "action": "read",
  "priority": 50,
  "enabled": true
}
```

### User Role Template (Self-access only)

```json
{
  "name": "User - {resource}:{action} (Self)",
  "effect": "allow",
  "subject": "role:user",
  "resource": "{resource}",
  "action": "{action}",
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

---

## ABAC Policy Naming Convention

### Format

```
{RoleName} - {Resource}:{Action}
```

### Examples

- `Super Admin - user:read`
- `Role: Admin - policy:create`
- `Role: 111 - audit:read`

### Priority Guidelines

| Role Type   | Priority Range | Description                     |
| ----------- | -------------- | ------------------------------- |
| Super Admin | 1000           | Highest priority, overrides all |
| Admin       | 100-999        | High priority for admin roles   |
| Standard    | 50-99          | Default for custom roles        |
| Restricted  | 1-49           | Low priority, may be overridden |

---

## Implementation Notes

### Creating ABAC Policies

1. **For existing roles:** Use the policy templates above with appropriate priority values
2. **For new roles:** Generate policies using the template format with `subject: "role:{roleName}"`
3. **For super_admin:** Recommend using single wildcard policy (Option A) for simplicity

### Migration Strategy

1. **Phase 1:** Create wildcard policy for `super_admin` (single policy)
2. **Phase 2:** Create granular policies for custom roles (`111`, `啊啊啊`)
3. **Phase 3:** Test ABAC evaluation with `USE_ABAC_ONLY=true`
4. **Phase 4:** Remove RBAC permission checks after verification

### Verification Commands

```bash
# Query current roles
npx tsx tools/query-roles.ts

# Audit ABAC coverage
pnpm run tools:audit-permissions

# Test specific role access
curl -X POST /api/v1/policy/evaluate \
  -H "Authorization: Bearer {token}" \
  -d '{"resource": "user", "action": "read"}'
```

---

## Appendix A: All RBAC Permissions Reference

| Permission          | Resource   | Action | Description               |
| ------------------- | ---------- | ------ | ------------------------- |
| `user:create`       | user       | create | Create new users          |
| `user:read`         | user       | read   | View user details         |
| `user:update`       | user       | update | Update user information   |
| `user:delete`       | user       | delete | Delete users              |
| `role:create`       | role       | create | Create new roles          |
| `role:read`         | role       | read   | View role details         |
| `role:update`       | role       | update | Update role information   |
| `role:delete`       | role       | delete | Delete roles              |
| `permission:create` | permission | create | Create new permissions    |
| `permission:read`   | permission | read   | View permission details   |
| `permission:update` | permission | update | Update permissions        |
| `permission:delete` | permission | delete | Delete permissions        |
| `policy:create`     | policy     | create | Create new policies       |
| `policy:read`       | policy     | read   | View policy details       |
| `policy:update`     | policy     | update | Update policy information |
| `policy:delete`     | policy     | delete | Delete policies           |
| `audit:read`        | audit      | read   | View audit logs           |

---

## Appendix B: Related Documents

- **Permission Audit Report:** `docs/permission-audit-report.md`
- **RoleGuard Decision:** `docs/role-guard-decision.md`
- **Migration Plan:** `.sisyphus/plans/abac-migration.md`
- **Learnings:** `.sisyphus/notepads/abac-migration/learnings.md`

---

_Document generated for RBAC→ABAC migration (Task 1.1)_
