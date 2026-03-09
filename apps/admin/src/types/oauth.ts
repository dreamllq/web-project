// ============================================
// OAuth Provider Types
// ============================================

/**
 * Provider metadata for display in admin panel
 */
export interface ProviderMetadata {
  code: string;
  displayName: string;
  icon: string;
  color: string;
  providerType: 'oauth2' | 'miniprogram';
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

/**
 * Response interface for OAuth provider configuration
 */
export interface OAuthProviderResponse {
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
 * Response interface for provider metadata list
 */
export interface ProviderMetadataResponse {
  code: string;
  displayName: string;
  icon: string;
  color: string;
  providerType: string;
  isEnabled: boolean;
}

// ============================================
// Batch Operation Types
// ============================================

/**
 * Result of a batch operation (delete, revoke, unlink, etc.)
 */
export interface BatchOperationResult {
  success: string[];
  failed: string[];
  errors: string[];
}

/**
 * DTO for batch provider IDs
 */
export interface BatchProviderIdsDto {
  ids: string[];
}

// ============================================
// OAuth Client Types
// ============================================

/**
 * OAuth Client entity
 */
export interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret: string; // Usually masked as '••••••••'
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  isConfidential: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO for creating OAuth client
 */
export interface CreateOAuthClientDto {
  name: string;
  redirectUris: string[];
  scopes: string[];
}

/**
 * DTO for updating OAuth client
 */
export interface UpdateOAuthClientDto {
  name?: string;
  redirectUris?: string[];
  scopes?: string[];
}

/**
 * Query parameters for listing OAuth clients
 */
export interface OAuthClientQueryDto {
  keyword?: string;
  limit?: number;
  offset?: number;
}

/**
 * Response for OAuth client with secret
 * Used only when creating or regenerating secret
 */
export interface OAuthClientWithSecret extends OAuthClient {
  clientSecret: string; // Plaintext secret (only shown once)
}

// ============================================
// OAuth Token Types
// ============================================

/**
 * OAuth Token entity
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
 * Query parameters for listing OAuth tokens
 */
export interface OAuthTokenQueryDto {
  clientId?: string;
  userId?: string;
  revoked?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Response for token list with pagination
 */
export interface OAuthTokenListResponse {
  data: OAuthToken[];
  total: number;
}

/**
 * DTO for batch revoking tokens
 */
export interface BatchRevokeTokensDto {
  ids: string[];
}

// ============================================
// Export Options Types
// ============================================

/**
 * Export options for OAuth tokens
 */
export interface ExportOptions {
  format?: 'csv' | 'json';
  includeUserPII?: boolean;
  clientId?: string;
  userId?: string;
  revoked?: boolean;
}

/**
 * Response for JSON export
 */
export interface ExportTokensJsonResponse {
  data: Array<{
    id: string;
    clientId: string;
    userId: string | null;
    accessToken: string;
    scopes: string[];
    expiresAt: string;
    revokedAt: string | null;
    createdAt: string;
    user?: {
      id: string;
      username: string;
      email: string | null;
    };
  }>;
  total: number;
  exportedAt: string;
}

// ============================================
// Social Account Types
// ============================================

/**
 * Social provider types
 */
export type SocialProvider =
  | 'wechat'
  | 'wechat_miniprogram'
  | 'dingtalk_miniprogram'
  | 'dingtalk'
  | 'feishu'
  | 'qq'
  | 'douyin'
  | 'baidu';

/**
 * Social account status
 */
export type SocialAccountStatus = 'linked' | 'unlinked';

/**
 * Social account entity
 */
export interface SocialAccount {
  id: string;
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  providerData: Record<string, unknown> | null;
  status: SocialAccountStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Query parameters for listing social accounts
 */
export interface SocialAccountQueryDto {
  provider?: SocialProvider;
  userId?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}

/**
 * Social account detail with user info and login history
 */
export interface SocialAccountDetail extends SocialAccount {
  user: {
    id: string;
    username: string;
    email: string | null;
  };
  loginHistory: {
    lastLoginAt: string | null;
    lastLoginIp: string | null;
    loginCount: number;
  };
}

/**
 * DTO for batch unlinking social accounts
 */
export interface BatchUnlinkDto {
  ids: string[];
}

// ============================================
// Common Response Types
// ============================================

/**
 * Generic paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}
