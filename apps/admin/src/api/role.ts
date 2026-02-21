import api from './index';
import type {
  Role,
  RoleListResponse,
  CreateRoleDto,
  UpdateRoleDto,
  AssignRoleDto,
  UserRoleResponse,
  UserPermissionsResponse,
} from '@/types/permission';

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
export function createRole(dto: CreateRoleDto): Promise<{ data: Role }> {
  return api.post('/v1/roles', dto);
}

/**
 * Update a role
 * PATCH /api/v1/roles/:id
 */
export function updateRole(id: string, dto: UpdateRoleDto): Promise<{ data: Role }> {
  return api.patch(`/v1/roles/${id}`, dto);
}

/**
 * Delete a role
 * DELETE /api/v1/roles/:id
 */
export function deleteRole(id: string): Promise<{ data: { success: boolean } }> {
  return api.delete(`/v1/roles/${id}`);
}

/**
 * Assign role to user
 * POST /api/v1/roles/users/:id/roles
 */
export function assignRole(
  userId: string,
  dto: AssignRoleDto
): Promise<{ data: { success: boolean } }> {
  return api.post(`/v1/roles/users/${userId}/roles`, dto);
}

/**
 * Remove role from user
 * DELETE /api/v1/roles/users/:id/roles/:roleId
 */
export function removeRole(
  userId: string,
  roleId: string
): Promise<{ data: { success: boolean } }> {
  return api.delete(`/v1/roles/users/${userId}/roles/${roleId}`);
}

/**
 * Get user roles
 * GET /api/v1/roles/users/:id/roles
 */
export function getUserRoles(userId: string): Promise<{ data: UserRoleResponse }> {
  return api.get(`/v1/roles/users/${userId}/roles`);
}

/**
 * Get user permissions (expanded from roles)
 * GET /api/v1/roles/users/:id/permissions
 */
export function getUserPermissions(userId: string): Promise<{ data: UserPermissionsResponse }> {
  return api.get(`/v1/roles/users/${userId}/permissions`);
}
