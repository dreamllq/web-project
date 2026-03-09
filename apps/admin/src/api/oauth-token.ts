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

/**
 * Batch operation result (matches backend BatchOperationResult)
 */
export interface BatchOperationResult {
  success: string[];
  failed: string[];
  errors: string[];
}

/**
 * Export tokens query parameters
 */
export interface ExportTokensQuery {
  format?: 'csv' | 'json';
  includeUserPII?: boolean;
  clientId?: string;
  userId?: string;
}

// ============================================
// API Functions
// ============================================

/**
 * Get list of OAuth tokens
 * GET /api/v1/oauth/tokens
 */
export function getOAuthTokens(
  params?: OAuthTokenQuery
): Promise<{ data: OAuthTokenListResponse }> {
  return api.get('/v1/oauth/tokens', { params });
}

/**
 * Delete (revoke) an OAuth token
 * DELETE /api/v1/oauth/tokens/:id
 */
export function deleteOAuthToken(id: string): Promise<void> {
  return api.delete(`/v1/oauth/tokens/${id}`);
}

/**
 * Export OAuth tokens to file (CSV or JSON)
 * GET /api/v1/oauth/tokens/export
 * Triggers file download in browser
 */
export async function exportTokens(query: ExportTokensQuery): Promise<void> {
  const params = new URLSearchParams();
  if (query.format) params.append('format', query.format);
  if (query.includeUserPII) params.append('includeUserPII', 'true');
  if (query.clientId) params.append('clientId', query.clientId);
  if (query.userId) params.append('userId', query.userId);

  const response = await api.get(`/v1/oauth/tokens/export?${params.toString()}`, {
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([response as any]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `oauth-tokens.${query.format || 'csv'}`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Batch revoke OAuth tokens
 * POST /api/v1/oauth/tokens/batch/revoke
 * Max 100 tokens per batch (enforced by backend)
 */
export function batchRevokeTokens(ids: string[]): Promise<{ data: BatchOperationResult }> {
  return api.post('/v1/oauth/tokens/batch/revoke', { ids });
}
