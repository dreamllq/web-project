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
  grants: string[];
  scope: string;
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
  grants?: string[];
  scope?: string;
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
 * Delete an OAuth client
 * DELETE /api/admin/oauth-clients/:id
 */
export function deleteOAuthClient(id: string): Promise<void> {
  return api.delete(`/admin/oauth-clients/${id}`);
}
