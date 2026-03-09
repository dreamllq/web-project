import api from './index';

// ============================================
// Type Definitions
// ============================================

export interface OAuthProvider {
  id: string;
  code: string;
  name: string;
  appId: string;
  redirectUri: string | null;
  enabled: boolean;
  displayName: string | null;
  icon: string | null;
  color: string | null;
  providerType: string | null;
  sortOrder: number | null;
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
  appId?: string;
  appSecret?: string;
  redirectUri?: string | null;
  enabled?: boolean;
}

export interface OAuthProviderQuery {
  type?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}

/**
 * Provider metadata response (for dynamic list display)
 */
export interface ProviderMetadata {
  code: string;
  displayName: string;
  icon: string;
  color: string;
  providerType: string;
  isEnabled: boolean;
}

/**
 * DTO for updating provider metadata (display settings)
 */
export interface UpdateProviderMetadataDto {
  displayName?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
}

// ============================================
// API Functions
// ============================================

/**
 * Get list of OAuth providers
 * GET /api/v1/admin/oauth-providers
 */
export function getOAuthProviders(params?: OAuthProviderQuery): Promise<{ data: OAuthProvider[] }> {
  return api.get('/v1/admin/oauth-providers', { params });
}

/**
 * Update an OAuth provider configuration
 * PATCH /api/v1/admin/oauth-providers/:id
 */
export function updateOAuthProvider(
  id: string,
  data: UpdateOAuthProviderDto
): Promise<{ data: OAuthProvider }> {
  return api.patch(`/v1/admin/oauth-providers/${id}`, data);
}

/**
 * Get provider metadata list (for dynamic UI display)
 * GET /api/v1/admin/oauth-providers/metadata
 */
export function getProvidersMetadata(): Promise<{ data: ProviderMetadata[] }> {
  return api.get('/v1/admin/oauth-providers/metadata');
}

/**
 * Update provider metadata (display settings)
 * PATCH /api/v1/admin/oauth-providers/:id
 */
export function updateMetadata(
  id: string,
  data: UpdateProviderMetadataDto
): Promise<{ data: OAuthProvider }> {
  return api.patch(`/v1/admin/oauth-providers/${id}`, data);
}

/**
 * Batch enable providers
 * POST /api/v1/admin/oauth-providers/batch/enable
 */
export function batchEnable(ids: string[]): Promise<{ data: { success: boolean } }> {
  return api.post('/v1/admin/oauth-providers/batch/enable', { ids });
}

/**
 * Batch disable providers
 * POST /api/v1/admin/oauth-providers/batch/disable
 */
export function batchDisable(ids: string[]): Promise<{ data: { success: boolean } }> {
  return api.post('/v1/admin/oauth-providers/batch/disable', { ids });
}
