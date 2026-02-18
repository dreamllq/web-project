import api from './index';
import type {
  Role,
  CreateRoleDto,
  UpdateRoleDto,
  RoleListResponse,
  PermissionListResponse,
  AssignRolesDto,
  UserRoleAssignment,
} from '@/types/rbac';

// ============================================
// Role Management API Functions
// ============================================

/**
 * Get all roles with pagination
 * GET /api/v1/rbac/roles
 */
export function getRoles(): Promise<{ data: RoleListResponse }> {
  return api.get('/v1/rbac/roles');
}

/**
 * Get a single role by ID
 * GET /api/v1/rbac/roles/:id
 */
export function getRole(id: string): Promise<{ data: Role }> {
  return api.get(`/v1/rbac/roles/${id}`);
}

/**
 * Create a new role
 * POST /api/v1/rbac/roles
 */
export function createRole(data: CreateRoleDto): Promise<{ data: Role }> {
  return api.post('/v1/rbac/roles', data);
}

/**
 * Update an existing role
 * PATCH /api/v1/rbac/roles/:id
 */
export function updateRole(id: string, data: UpdateRoleDto): Promise<{ data: Role }> {
  return api.patch(`/v1/rbac/roles/${id}`, data);
}

/**
 * Delete a role
 * DELETE /api/v1/rbac/roles/:id
 */
export function deleteRole(id: string): Promise<{ data: { success: boolean; message: string } }> {
  return api.delete(`/v1/rbac/roles/${id}`);
}

/**
 * Get all available permissions
 * GET /api/v1/rbac/permissions
 */
export function getPermissions(): Promise<{ data: PermissionListResponse }> {
  return api.get('/v1/rbac/permissions');
}

// ============================================
// User Role Assignment API Functions
// ============================================

/**
 * Get roles assigned to a user
 * GET /api/v1/users/:userId/roles
 */
export function getUserRoles(userId: string): Promise<{ data: UserRoleAssignment }> {
  return api.get(`/v1/users/${userId}/roles`);
}

/**
 * Assign roles to a user
 * PUT /api/v1/users/:userId/roles
 */
export function assignUserRoles(
  userId: string,
  data: AssignRolesDto
): Promise<{ data: { success: boolean; message: string; roles: Role[] } }> {
  return api.put(`/v1/users/${userId}/roles`, data);
}

/**
 * Remove a specific role from a user
 * DELETE /api/v1/users/:userId/roles/:roleId
 */
export function removeUserRole(
  userId: string,
  roleId: string
): Promise<{ data: { success: boolean; message: string } }> {
  return api.delete(`/v1/users/${userId}/roles/${roleId}`);
}
