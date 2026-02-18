// ============================================
// RBAC (Role-Based Access Control) Types
// ============================================

/**
 * Permission definition
 * Represents a single permission in the system
 */
export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
}

/**
 * Role definition with associated permissions
 */
export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Role Management DTOs
// ============================================

/**
 * DTO for creating a new role
 */
export interface CreateRoleDto {
  name: string;
  description?: string;
  permissionIds?: string[];
}

/**
 * DTO for updating an existing role
 */
export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

/**
 * Response wrapper for role list API
 */
export interface RoleListResponse {
  data: Role[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Response wrapper for single role API
 */
export interface RoleResponse {
  data: Role;
}

// ============================================
// Permission Management Types
// ============================================

/**
 * Response wrapper for permission list API
 */
export interface PermissionListResponse {
  data: Permission[];
}

// ============================================
// User Role Assignment Types
// ============================================

/**
 * User's role assignment information
 */
export interface UserRoleAssignment {
  userId: string;
  roles: Role[];
}

/**
 * DTO for assigning roles to a user
 */
export interface AssignRolesDto {
  roleIds: string[];
}

/**
 * Response wrapper for user role assignment API
 */
export interface UserRoleAssignmentResponse {
  success: boolean;
  message: string;
  roles: Role[];
}
