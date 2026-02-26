import api from './index';
import type { Permission, PermissionListResponse } from '@/types/permission';

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
