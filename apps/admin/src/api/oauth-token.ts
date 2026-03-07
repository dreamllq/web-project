import api from './index';

// ============================================
// Type Definitions
// ============================================

export interface OAuthToken {
  id: string;
  accessToken: string;
  refreshToken?: string;
  clientId: string;
  userId?: string;
  expiresAt: string;
  scope: string;
  createdAt: string;
}

export interface OAuthTokenListResponse {
  data: OAuthToken[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface OAuthTokenQuery {
  clientId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// API Functions
// ============================================

/**
 * Get list of OAuth tokens
 * GET /api/admin/oauth-tokens
 */
export function getOAuthTokens(
  params?: OAuthTokenQuery
): Promise<{ data: OAuthTokenListResponse }> {
  return api.get('/admin/oauth-tokens', { params });
}

/**
 * Delete (revoke) an OAuth token
 * DELETE /api/admin/oauth-tokens/:id
 */
export function deleteOAuthToken(id: string): Promise<void> {
  return api.delete(`/admin/oauth-tokens/${id}`);
}
