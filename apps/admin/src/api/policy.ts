import api from './index';
import type {
  Policy,
  PolicyListResponse,
  CreatePolicyDto,
  UpdatePolicyDto,
  QueryPolicyDto,
  CheckPermissionResponse,
} from '@/types/permission';

// ============================================
// Policy Management API Functions
// ============================================

const VERSION_PREFIX = '/v1';

/**
 * Get paginated list of policies
 * GET /api/v1/policies
 */
export function getPolicies(params?: QueryPolicyDto): Promise<{ data: PolicyListResponse }> {
  return api.get(`${VERSION_PREFIX}/policies`, { params });
}

/**
 * Get a single policy by ID
 * GET /api/v1/policies/:id
 */
export function getPolicy(id: string): Promise<{ data: Policy }> {
  return api.get(`${VERSION_PREFIX}/policies/${id}`);
}

/**
 * Create a new policy
 * POST /api/v1/policies
 */
export function createPolicy(dto: CreatePolicyDto): Promise<{ data: Policy }> {
  return api.post(`${VERSION_PREFIX}/policies`, dto);
}

/**
 * Update a policy
 * PUT /api/v1/policies/:id
 */
export function updatePolicy(id: string, dto: UpdatePolicyDto): Promise<{ data: Policy }> {
  return api.put(`${VERSION_PREFIX}/policies/${id}`, dto);
}

/**
 * Delete a policy
 * DELETE /api/v1/policies/:id
 */
export function deletePolicy(id: string): Promise<{ data: { message: string } }> {
  return api.delete(`${VERSION_PREFIX}/policies/${id}`);
}

/**
 * Check permission
 * GET /api/v1/policies/check/permission
 */
export function checkPermission(
  resource: string,
  action: string
): Promise<{ data: CheckPermissionResponse }> {
  return api.get(`${VERSION_PREFIX}/policies/check/permission`, { params: { resource, action } });
}

/**
 * Bulk check permissions
 * POST /api/v1/policies/check/bulk
 */
export function checkBulkPermissions(
  requests: Array<{ resource: string; action: string }>
): Promise<{ data: Record<string, boolean> }> {
  return api.post(`${VERSION_PREFIX}/policies/check/bulk`, requests);
}
