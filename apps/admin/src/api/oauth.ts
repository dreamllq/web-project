import api from './index';

// ============================================
// Type Definitions
// ============================================

export interface OAuthClient {
  id: string;
  name: string;
  clientId: string;
  clientSecret?: string;
  redirectUris: string[];
  scopes: string[];
  isConfidential: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthClientListResponse {
  data: OAuthClient[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface CreateOAuthClientDto {
  name: string;
  redirectUris: string[];
  scopes?: string[];
  isConfidential?: boolean;
}

export interface UpdateOAuthClientDto {
  name?: string;
  redirectUris?: string[];
  scopes?: string[];
  isConfidential?: boolean;
  isActive?: boolean;
}

export interface OAuthClientQuery {
  keyword?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// API Functions
// ============================================

/**
 * Get list of OAuth clients
 * GET /api/admin/oauth-clients
 */
export function getOAuthClients(
  params?: OAuthClientQuery
): Promise<{ data: OAuthClientListResponse }> {
  return api.get('/admin/oauth-clients', { params });
}

/**
 * Create a new OAuth client
 * POST /api/admin/oauth-clients
 */
export function createOAuthClient(data: CreateOAuthClientDto): Promise<{ data: OAuthClient }> {
  return api.post('/admin/oauth-clients', data);
}

/**
 * Update an OAuth client
 * PATCH /api/admin/oauth-clients/:id
 */
export function updateOAuthClient(
  id: string,
  data: UpdateOAuthClientDto
): Promise<{ data: OAuthClient }> {
  return api.patch(`/admin/oauth-clients/${id}`, data);
}

/**
 * Regenerate client secret
 * POST /api/admin/oauth-clients/:id/regenerate-secret
 */
export function regenerateClientSecret(id: string): Promise<{ data: OAuthClient }> {
  return api.post(`/admin/oauth-clients/${id}/regenerate-secret`);
}

/**
 * Delete an OAuth client
 * DELETE /api/admin/oauth-clients/:id
 */
export function deleteOAuthClient(id: string): Promise<void> {
  return api.delete(`/admin/oauth-clients/${id}`);
}
