import api from './index';

// ============================================
// Type Definitions
// ============================================

export interface ApiKey {
  id: string;
  name: string;
  key?: string;
  userId: string;
  permissions: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyListResponse {
  data: ApiKey[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface CreateApiKeyDto {
  name: string;
  permissions?: string[];
  expiresAt?: string;
}

export interface ApiKeyQuery {
  userId?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// API Functions
// ============================================

/**
 * Get list of API keys
 * GET /api/v1/api-keys
 */
export function getApiKeys(params?: ApiKeyQuery): Promise<{ data: ApiKeyListResponse }> {
  return api.get('/v1/api-keys', { params });
}

/**
 * Create a new API key
 * POST /api/v1/api-keys
 */
export function createApiKey(data: CreateApiKeyDto): Promise<{ data: ApiKey }> {
  return api.post('/v1/api-keys', data);
}

/**
 * Delete (revoke) an API key
 * DELETE /api/v1/api-keys/:id
 */
export function deleteApiKey(id: string): Promise<void> {
  return api.delete(`/v1/api-keys/${id}`);
}
