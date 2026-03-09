import api from './index';

// ============================================
// Type Definitions
// ============================================

export interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret: string;
  name: string;
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
 * Get list of OAuth clients with pagination
 * GET /api/v1/oauth/clients
 */
export function listClients(params?: OAuthClientQuery): Promise<OAuthClientListResponse> {
  return api.get('/v1/oauth/clients', { params });
}

/**
 * Get a single OAuth client by ID
 * GET /api/v1/oauth/clients/:id
 */
export function getClient(id: string): Promise<OAuthClient> {
  return api.get(`/v1/oauth/clients/${id}`);
}

/**
 * Create a new OAuth client
 * POST /api/v1/oauth/clients
 * Note: Returns plain client secret once (only on create)
 */
export function createClient(data: CreateOAuthClientDto): Promise<OAuthClient> {
  return api.post('/v1/oauth/clients', data);
}

/**
 * Update an OAuth client
 * PATCH /api/v1/oauth/clients/:id
 */
export function updateClient(id: string, data: UpdateOAuthClientDto): Promise<OAuthClient> {
  return api.patch(`/v1/oauth/clients/${id}`, data);
}

/**
 * Delete an OAuth client
 * DELETE /api/v1/oauth/clients/:id
 * Note: Fails if client has active tokens
 */
export function deleteClient(id: string): Promise<void> {
  return api.delete(`/v1/oauth/clients/${id}`);
}

/**
 * Regenerate client secret
 * POST /api/v1/oauth/clients/:id/regenerate-secret
 * Note: Returns plain client secret once (only on regenerate)
 */
export function regenerateSecret(id: string): Promise<OAuthClient> {
  return api.post(`/v1/oauth/clients/${id}/regenerate-secret`);
}
