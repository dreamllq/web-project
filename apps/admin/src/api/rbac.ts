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
 * Get all roles
 * GET /api/v1/roles
 */
export function getRoles(): Promise<{ data: RoleListResponse }> {
  return api.get('/v1/roles');
}

/**
 * Create a new role
 * POST /api/v1/roles
 */
export function createRole(data: CreateRoleDto): Promise<{ data: Role }> {
  return api.post('/v1/roles', data);
}

/**
 * Update an existing role
 * PATCH /api/v1/roles/:id
 */
export function updateRole(id: string, data: UpdateRoleDto): Promise<{ data: Role }> {
  return api.patch(`/v1/roles/${id}`, data);
}

/**
 * Delete a role
 * DELETE /api/v1/roles/:id
 */
export function deleteRole(id: string): Promise<{ data: { success: boolean; message: string } }> {
  return api.delete(`/v1/roles/${id}`);
}

/**
 * Get all available permissions
 * GET /api/v1/permissions
 */
export function getPermissions(): Promise<{ data: PermissionListResponse }> {
  return api.get('/v1/permissions');
}

// ============================================
// User Role Assignment API Functions
// ============================================

/**
 * Get roles assigned to a user
 * GET /api/v1/roles/users/:id/roles
 */
export function getUserRoles(userId: string): Promise<{ data: UserRoleAssignment }> {
  return api.get(`/v1/roles/users/${userId}/roles`);
}

/**
 * Assign roles to a user
 * POST /api/v1/roles/users/:id/roles
 */
export function assignUserRoles(
  userId: string,
  data: AssignRolesDto
): Promise<{ data: { success: boolean; message: string; roles: Role[] } }> {
  return api.post(`/v1/roles/users/${userId}/roles`, data);
}

/**
 * Remove a specific role from a user
 * DELETE /api/v1/roles/users/:id/roles/:roleId
 */
export function removeUserRole(
  userId: string,
  roleId: string
): Promise<{ data: { success: boolean; message: string } }> {
  return api.delete(`/v1/roles/users/${userId}/roles/${roleId}`);
}

/**
 * Get permissions for a user
 * GET /api/v1/roles/users/:id/permissions
 */
export function getUserPermissions(userId: string): Promise<{ data: string[] }> {
  return api.get(`/v1/roles/users/${userId}/permissions`);
}
