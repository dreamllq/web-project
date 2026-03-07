import api from './index';

// ============================================
// Type Definitions
// ============================================

export interface OAuthProvider {
  id: string;
  name: string;
  type: string;
  clientId: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scope?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OAuthProviderListResponse {
  data: OAuthProvider[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface UpdateOAuthProviderDto {
  name?: string;
  clientId?: string;
  clientSecret?: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scope?: string;
  isActive?: boolean;
}

export interface OAuthProviderQuery {
  type?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// API Functions
// ============================================

/**
 * Get list of OAuth providers
 * GET /api/admin/oauth-providers
 */
export function getOAuthProviders(
  params?: OAuthProviderQuery
): Promise<{ data: OAuthProviderListResponse }> {
  return api.get('/admin/oauth-providers', { params });
}

/**
 * Update an OAuth provider configuration
 * PATCH /api/admin/oauth-providers/:id
 */
export function updateOAuthProvider(
  id: string,
  data: UpdateOAuthProviderDto
): Promise<{ data: OAuthProvider }> {
  return api.patch(`/admin/oauth-providers/${id}`, data);
}
