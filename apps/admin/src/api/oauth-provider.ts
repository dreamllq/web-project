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
  configName: string;
  appId: string;
  redirectUri: string | null;
  generatedCallbackUrl: string | null;
  frontendRedirectUrl: string | null;
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
 * @returns Array of providers
 */
export async function listProviders(): Promise<OAuthProvider[]> {
  const response = await api.get<{ data: OAuthProvider[] }>('/v1/oauth/providers');
  return response.data.data;
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
 * @returns Array of metadata
 */
export async function getMetadata(): Promise<ProviderMetadata[]> {
  const response = await api.get<{ data: ProviderMetadata[] }>('/v1/oauth/providers/metadata');
  return response.data.data;
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

// ============================================
// Create Provider DTO
// ============================================

/**
 * DTO for creating a new OAuth provider configuration
 * Matches backend CreateProviderDto
 */
export interface CreateProviderDto {
  code: OAuthProviderCode | string;
  configName: string;
  appId: string;
  appSecret: string;
  redirectUri?: string;
  frontendRedirectUrl?: string;
  displayName?: string;
  icon?: string;
  color?: string;
  sortOrder?: number;
  isDefault?: boolean;
}

/**
 * Create a new OAuth provider configuration
 * POST /v1/oauth/providers
 * @param data - Provider configuration data
 * @returns Created provider
 */
export function createProvider(data: CreateProviderDto): Promise<OAuthProvider> {
  return api.post('/v1/oauth/providers', data);
}

/**
 * Delete an OAuth provider configuration
 * DELETE /v1/oauth/providers/:id
 * @param id - Provider UUID
 * @returns void
 */
export function deleteProvider(id: string): Promise<void> {
  return api.delete(`/v1/oauth/providers/${id}`);
}

// ============================================
// Login Options (Public API)
// ============================================

/**
 * Response interface for login option
 * Matches backend LoginOptionResponse
 */
export interface LoginOption {
  code: string;
  displayName: string;
  icon: string;
  color: string;
  enabled: boolean;
  sortOrder: number;
}

/**
 * Get available OAuth login options (public endpoint)
 * GET /v1/oauth/login-options
 * @returns Array of login options
 */
export async function getLoginOptions(): Promise<LoginOption[]> {
  const response = await api.get<{ data: LoginOption[] }>('/v1/oauth/login-options');
  return response.data.data;
}

// ============================================
// Test Login Types
// ============================================

/**
 * Response for starting test login
 */
export interface TestLoginUrlResponse {
  url: string;
  configId: string;
  provider: string;
}

/**
 * Response for test login result
 */
export interface TestLoginResponse {
  providerUserId: string;
  nickname: string | null;
  avatarUrl: string | null;
  provider: string;
  rawUserInfo: Record<string, unknown>;
}

// ============================================
// Test Login API Functions
// ============================================

/**
 * Start test login - get OAuth authorization URL
 * POST /v1/oauth/providers/test-login/:configId
 * @param configId - Provider configuration UUID
 * @returns Authorization URL and config info
 */
export function startTestLogin(configId: string): Promise<TestLoginUrlResponse> {
  return api.post(`/v1/oauth/providers/test-login/${configId}`);
}

/**
 * Get test login result after OAuth callback
 * GET /v1/oauth/providers/test-login/:configId/callback
 * @param configId - Provider configuration UUID
 * @param code - OAuth authorization code
 * @returns Test user info from OAuth provider
 */
export function getTestLoginResult(configId: string, code: string): Promise<TestLoginResponse> {
  return api.get(`/v1/oauth/providers/test-login/${configId}/callback`, {
    params: { code },
  });
}
