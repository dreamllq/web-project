import api from './index';
import type { Policy, CreatePolicyDto, UpdatePolicyDto, QueryPolicyDto } from '@/types/policy';

// ============================================
// Policy Management API Functions
// ============================================

/**
 * Get all policies with optional filtering and pagination
 * GET /api/v1/policies
 */
export async function getPolicies(
  query?: QueryPolicyDto
): Promise<{ data: Policy[]; total: number; page: number; limit: number }> {
  const response = await api.get<{ data: Policy[]; total: number; page: number; limit: number }>(
    '/v1/policies',
    { params: query }
  );
  return response.data;
}

/**
 * Get a specific policy by ID
 * GET /api/v1/policies/:id
 */
export async function getPolicy(id: string): Promise<{ data: Policy }> {
  const response = await api.get<{ data: Policy }>(`/v1/policies/${id}`);
  return response.data;
}

/**
 * Create a new policy
 * POST /api/v1/policies
 */
export async function createPolicy(data: CreatePolicyDto): Promise<{ data: Policy }> {
  const response = await api.post<{ data: Policy }>('/v1/policies', data);
  return response.data;
}

/**
 * Update an existing policy
 * PUT /api/v1/policies/:id
 */
export async function updatePolicy(id: string, data: UpdatePolicyDto): Promise<{ data: Policy }> {
  const response = await api.put<{ data: Policy }>(`/v1/policies/${id}`, data);
  return response.data;
}

/**
 * Delete a policy
 * DELETE /api/v1/policies/:id
 */
export async function deletePolicy(id: string): Promise<{ data: { message: string } }> {
  const response = await api.delete<{ data: { message: string } }>(`/v1/policies/${id}`);
  return response.data;
}

/**
 * Toggle policy enabled status
 * PUT /api/v1/policies/:id
 */
export async function togglePolicyEnabled(id: string, enabled: boolean): Promise<{ data: Policy }> {
  const response = await api.put<{ data: Policy }>(`/v1/policies/${id}`, { enabled });
  return response.data;
}

// ============================================
// Permission Check API Functions
// ============================================

/**
 * Check permission for a specific resource and action
 * GET /api/v1/policies/check/permission
 */
export async function checkPermission(
  resource: string,
  action: string
): Promise<{ data: { allowed: boolean; resource: string; action: string } }> {
  const response = await api.get<{ data: { allowed: boolean; resource: string; action: string } }>(
    '/v1/policies/check/permission',
    { params: { resource, action } }
  );
  return response.data;
}

/**
 * Bulk check permissions for multiple resources/actions
 * POST /api/v1/policies/check/bulk
 */
export async function checkBulkPermissions(
  requests: Array<{ resource: string; action: string }>
): Promise<{ data: Record<string, boolean> }> {
  const response = await api.post<{ data: Record<string, boolean> }>(
    '/v1/policies/check/bulk',
    requests
  );
  return response.data;
}
