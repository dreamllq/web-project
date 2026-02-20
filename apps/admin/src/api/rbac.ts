import api from './index';
import type {
  Role,
  Permission,
  CreateRoleDto,
  UpdateRoleDto,
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
export async function getRoles(): Promise<{ data: Role[] }> {
  const response = await api.get<{ data: Role[] }>('/v1/roles');
  return response.data;
}

/**
 * Create a new role
 * POST /api/v1/roles
 */
export async function createRole(data: CreateRoleDto): Promise<{ data: Role }> {
  const response = await api.post<{ data: Role }>('/v1/roles', data);
  return response.data;
}

/**
 * Update an existing role
 * PATCH /api/v1/roles/:id
 */
export async function updateRole(id: string, data: UpdateRoleDto): Promise<{ data: Role }> {
  const response = await api.patch<{ data: Role }>(`/v1/roles/${id}`, data);
  return response.data;
}

/**
 * Delete a role
 * DELETE /api/v1/roles/:id
 */
export async function deleteRole(
  id: string
): Promise<{ data: { success: boolean; message: string } }> {
  const response = await api.delete<{ data: { success: boolean; message: string } }>(
    `/v1/roles/${id}`
  );
  return response.data;
}

/**
 * Get all available permissions
 * GET /api/v1/permissions
 */
export async function getPermissions(): Promise<{ data: Permission[] }> {
  const response = await api.get<{ data: Permission[] }>('/v1/permissions');
  return response.data;
}

// ============================================
// User Role Assignment API Functions
// ============================================

/**
 * Get roles assigned to a user
 * GET /api/v1/roles/users/:id/roles
 */
export async function getUserRoles(userId: string): Promise<{ data: UserRoleAssignment }> {
  const response = await api.get<{ data: UserRoleAssignment }>(`/v1/roles/users/${userId}/roles`);
  return response.data;
}

/**
 * Assign roles to a user
 * POST /api/v1/roles/users/:id/roles
 */
export async function assignUserRoles(
  userId: string,
  data: AssignRolesDto
): Promise<{ data: { success: boolean; message: string; roles: Role[] } }> {
  const response = await api.post<{ data: { success: boolean; message: string; roles: Role[] } }>(
    `/v1/roles/users/${userId}/roles`,
    data
  );
  return response.data;
}

/**
 * Remove a specific role from a user
 * DELETE /api/v1/roles/users/:id/roles/:roleId
 */
export async function removeUserRole(
  userId: string,
  roleId: string
): Promise<{ data: { success: boolean; message: string } }> {
  const response = await api.delete<{ data: { success: boolean; message: string } }>(
    `/v1/roles/users/${userId}/roles/${roleId}`
  );
  return response.data;
}

/**
 * Get permissions for a user
 * GET /api/v1/roles/users/:id/permissions
 */
export async function getUserPermissions(userId: string): Promise<{ data: string[] }> {
  const response = await api.get<{ data: string[] }>(`/v1/roles/users/${userId}/permissions`);
  return response.data;
}
