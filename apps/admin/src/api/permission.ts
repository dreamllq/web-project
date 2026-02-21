import api from './index';
import type { Permission, PermissionListResponse, CreatePermissionDto } from '@/types/permission';

// ============================================
// Permission Management API Functions
// ============================================

/**
 * Get all permissions
 * GET /api/v1/permissions
 */
export function getPermissions(): Promise<{ data: PermissionListResponse }> {
  return api.get('/v1/permissions');
}

/**
 * Get a single permission by ID
 * GET /api/v1/permissions/:id
 */
export function getPermission(id: string): Promise<{ data: Permission | null }> {
  return api.get(`/v1/permissions/${id}`);
}

/**
 * Get permissions by resource
 * GET /api/v1/permissions/resource/:resource
 */
export function getPermissionsByResource(resource: string): Promise<{ data: Permission[] }> {
  return api.get(`/v1/permissions/resource/${resource}`);
}

/**
 * Create a new permission
 * POST /api/v1/permissions
 */
export function createPermission(dto: CreatePermissionDto): Promise<{ data: Permission }> {
  return api.post('/v1/permissions', dto);
}

/**
 * Delete a permission
 * DELETE /api/v1/permissions/:id
 */
export function deletePermission(id: string): Promise<{ data: { success: boolean } }> {
  return api.delete(`/v1/permissions/${id}`);
}
