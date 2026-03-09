import api from './index';

// ============================================
// Type Definitions (match backend DTOs exactly)
// ============================================

/**
 * OAuth token response (matches backend OAuthTokenResponse)
 */
export interface OAuthToken {
  id: string;
  clientId: string;
  userId: string | null;
  accessToken: string;
  scopes: string[];
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * Query parameters for listing OAuth tokens (matches backend OAuthTokenQueryDto)
 */
export interface OAuthTokenQuery {
  clientId?: string;
  userId?: string;
  revoked?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Response for token list (matches backend OAuthTokenListResponse)
 */
export interface OAuthTokenListResponse {
  data: OAuthToken[];
  total: number;
}

/**
 * DTO for batch revoke tokens (matches backend BatchRevokeTokensDto)
 */
export interface BatchRevokeTokensDto {
  ids: string[];
}

/**
 * Result of batch operation (matches backend BatchOperationResult)
 */
export interface BatchOperationResult {
  success: string[];
  failed: string[];
  errors: string[];
}

// ============================================
// API Functions
// ============================================

/**
 * Get list of OAuth tokens with filters
 * GET /v1/oauth/tokens
 */
export function listTokens(query?: OAuthTokenQuery): Promise<OAuthTokenListResponse> {
  return api.get('/v1/oauth/tokens', { params: query });
}

/**
 * Revoke (delete) a single OAuth token
 * DELETE /v1/oauth/tokens/:id
 * Returns the revoked token
 */
export function revokeToken(id: string): Promise<OAuthToken> {
  return api.delete(`/v1/oauth/tokens/${id}`);
}

/**
 * Batch revoke OAuth tokens
 * POST /v1/oauth/tokens/batch/revoke
 * Max 100 tokens per batch (enforced by backend)
 */
export function batchRevokeTokens(dto: BatchRevokeTokensDto): Promise<BatchOperationResult> {
  return api.post('/v1/oauth/tokens/batch/revoke', dto);
}

/**
 * Export OAuth tokens to CSV file
 * GET /v1/oauth/tokens/export
 * Triggers file download in browser
 */
export async function exportTokens(query?: OAuthTokenQuery): Promise<void> {
  const params = new URLSearchParams();
  if (query?.clientId) params.append('clientId', query.clientId);
  if (query?.userId) params.append('userId', query.userId);
  if (query?.revoked !== undefined) params.append('revoked', String(query.revoked));

  const response = await api.get(`/v1/oauth/tokens/export?${params.toString()}`, {
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([response as unknown as BlobPart]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'oauth-tokens.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
