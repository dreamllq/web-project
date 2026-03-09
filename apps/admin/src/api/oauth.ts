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
  allowedScopes: string[];
  isConfidential: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthClientListResponse {
  data: OAuthClient[];
  total: number;
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
 * GET /api/v1/oauth/clients
 */
export function getOAuthClients(
  params?: OAuthClientQuery
): Promise<{ data: OAuthClientListResponse }> {
  return api.get('/v1/oauth/clients', { params });
}

/**
 * Create a new OAuth client
 * POST /api/v1/oauth/clients
 */
export function createOAuthClient(data: CreateOAuthClientDto): Promise<{ data: OAuthClient }> {
  return api.post('/v1/oauth/clients', data);
}

/**
 * Update an OAuth client
 * PATCH /api/v1/oauth/clients/:id
 */
export function updateOAuthClient(
  id: string,
  data: UpdateOAuthClientDto
): Promise<{ data: OAuthClient }> {
  return api.patch(`/v1/oauth/clients/${id}`, data);
}

/**
 * Regenerate client secret
 * POST /api/v1/oauth/clients/:id/regenerate-secret
 */
export function regenerateClientSecret(id: string): Promise<{ data: OAuthClient }> {
  return api.post(`/v1/oauth/clients/${id}/regenerate-secret`);
}

/**
 * Delete an OAuth client
 * DELETE /api/v1/oauth/clients/:id
 */
export function deleteOAuthClient(id: string): Promise<void> {
  return api.delete(`/v1/oauth/clients/${id}`);
}
