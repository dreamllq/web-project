import api from './index';
import type { Policy, CreatePolicyDto, UpdatePolicyDto, QueryPolicyDto } from '@/types/policy';

// ============================================
// Policy Management API Functions
// ============================================

/**
 * Get all policies with optional filtering and pagination
 * GET /api/v1/policies
 */
export function getPolicies(
  query?: QueryPolicyDto
): Promise<{ data: Policy[]; total: number; page: number; limit: number }> {
  return api.get('/v1/policies', { params: query });
}

/**
 * Get a specific policy by ID
 * GET /api/v1/policies/:id
 */
export function getPolicy(id: string): Promise<{ data: Policy }> {
  return api.get(`/v1/policies/${id}`);
}

/**
 * Create a new policy
 * POST /api/v1/policies
 */
export function createPolicy(data: CreatePolicyDto): Promise<{ data: Policy }> {
  return api.post('/v1/policies', data);
}

/**
 * Update an existing policy
 * PUT /api/v1/policies/:id
 */
export function updatePolicy(id: string, data: UpdatePolicyDto): Promise<{ data: Policy }> {
  return api.put(`/v1/policies/${id}`, data);
}

/**
 * Delete a policy
 * DELETE /api/v1/policies/:id
 */
export function deletePolicy(id: string): Promise<{ data: { message: string } }> {
  return api.delete(`/v1/policies/${id}`);
}

/**
 * Toggle policy enabled status
 * PUT /api/v1/policies/:id
 */
export function togglePolicyEnabled(id: string, enabled: boolean): Promise<{ data: Policy }> {
  return api.put(`/v1/policies/${id}`, { enabled });
}

// ============================================
// Permission Check API Functions
// ============================================

/**
 * Check permission for a specific resource and action
 * GET /api/v1/policies/check/permission
 */
export function checkPermission(
  resource: string,
  action: string
): Promise<{ data: { allowed: boolean; resource: string; action: string } }> {
  return api.get('/v1/policies/check/permission', {
    params: { resource, action },
  });
}

/**
 * Bulk check permissions for multiple resources/actions
 * POST /api/v1/policies/check/bulk
 */
export function checkBulkPermissions(
  requests: Array<{ resource: string; action: string }>
): Promise<{ data: Record<string, boolean> }> {
  return api.post('/v1/policies/check/bulk', requests);
}
