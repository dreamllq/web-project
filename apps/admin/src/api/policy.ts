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

/**
 * Get paginated list of policies
 * GET /api/policies
 */
export function getPolicies(params?: QueryPolicyDto): Promise<{ data: PolicyListResponse }> {
  return api.get('/policies', { params });
}

/**
 * Get a single policy by ID
 * GET /api/policies/:id
 */
export function getPolicy(id: string): Promise<{ data: Policy }> {
  return api.get(`/policies/${id}`);
}

/**
 * Create a new policy
 * POST /api/policies
 */
export function createPolicy(dto: CreatePolicyDto): Promise<{ data: Policy }> {
  return api.post('/policies', dto);
}

/**
 * Update a policy
 * PUT /api/policies/:id
 */
export function updatePolicy(id: string, dto: UpdatePolicyDto): Promise<{ data: Policy }> {
  return api.put(`/policies/${id}`, dto);
}

/**
 * Delete a policy
 * DELETE /api/policies/:id
 */
export function deletePolicy(id: string): Promise<{ data: { message: string } }> {
  return api.delete(`/policies/${id}`);
}

/**
 * Check permission
 * GET /api/policies/check/permission
 */
export function checkPermission(
  resource: string,
  action: string
): Promise<{ data: CheckPermissionResponse }> {
  return api.get('/policies/check/permission', { params: { resource, action } });
}

/**
 * Bulk check permissions
 * POST /api/policies/check/bulk
 */
export function checkBulkPermissions(
  requests: Array<{ resource: string; action: string }>
): Promise<{ data: Record<string, boolean> }> {
  return api.post('/policies/check/bulk', requests);
}
