import api from './index';

// ============================================
// Enums
// ============================================

/**
 * OAuth provider codes - matches backend OAuthProviderCode enum
 */
export enum OAuthProviderCode {
  WECHAT = 'wechat',
  WECHAT_MINIPROGRAM = 'wechat_miniprogram',
  DINGTALK_MINIPROGRAM = 'dingtalk_miniprogram',
  DINGTALK = 'dingtalk',
  FEISHU = 'feishu',
  DOUYIN = 'douyin',
  QQ = 'qq',
  BAIDU = 'baidu',
}

// ============================================
// Type Definitions
// ============================================

/**
 * Response interface for OAuth provider (without sensitive data)
 * Matches backend OAuthProviderResponse
 */
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

/**
 * Response interface for provider metadata
 * Matches backend ProviderMetadataResponse
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
 * Matches backend UpdateProviderMetadataDto
 */
export interface UpdateProviderMetadataDto {
  displayName?: string;
  icon?: string;
  color?: string;
  sortOrder?: number; // 0-999
}

/**
 * DTO for batch operations with provider IDs
 * Matches backend BatchProviderIdsDto
 */
export interface BatchProviderIdsDto {
  ids: string[];
}

// ============================================
// API Functions
// ============================================

/**
 * Get list of OAuth providers
 * GET /v1/oauth/providers
 * @returns Array of providers (not wrapped)
 */
export function listProviders(): Promise<OAuthProvider[]> {
  return api.get('/v1/oauth/providers');
}

/**
 * Get single OAuth provider by ID
 * GET /v1/oauth/providers/:id
 * @param id - Provider UUID
 * @returns Single provider
 */
export function getProvider(id: string): Promise<OAuthProvider> {
  return api.get(`/v1/oauth/providers/${id}`);
}

/**
 * Get provider metadata list (for dynamic UI display)
 * GET /v1/oauth/providers/metadata
 * @returns Array of metadata (not wrapped)
 */
export function getMetadata(): Promise<ProviderMetadata[]> {
  return api.get('/v1/oauth/providers/metadata');
}

/**
 * Update provider metadata (display settings)
 * PATCH /v1/oauth/providers/:id
 * @param id - Provider UUID
 * @param data - Metadata to update
 * @returns Updated provider
 */
export function updateProvider(
  id: string,
  data: UpdateProviderMetadataDto
): Promise<OAuthProvider> {
  return api.patch(`/v1/oauth/providers/${id}`, data);
}

/**
 * Batch enable providers
 * POST /v1/oauth/providers/batch/enable
 * @param ids - Array of provider UUIDs
 * @returns Success response
 */
export function batchEnable(ids: string[]): Promise<{ success: boolean }> {
  return api.post('/v1/oauth/providers/batch/enable', { ids });
}

/**
 * Batch disable providers
 * POST /v1/oauth/providers/batch/disable
 * @param ids - Array of provider UUIDs
 * @returns Success response
 */
export function batchDisable(ids: string[]): Promise<{ success: boolean }> {
  return api.post('/v1/oauth/providers/batch/disable', { ids });
}
