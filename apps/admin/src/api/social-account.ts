import api from './index';

// ============================================
// Type Definitions
// ============================================

export interface SocialAccount {
  id: string;
  provider: string;
  providerUserId: string;
  userId: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SocialAccountListResponse {
  data: SocialAccount[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface SocialAccountQuery {
  provider?: string;
  userId?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}

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

export interface BatchOperationResult {
  success: string[];
  failed: string[];
  errors: string[];
}

// ============================================
// API Functions
// ============================================

/**
 * Get list of social accounts
 * GET /api/v1/social-accounts
 */
export function getSocialAccounts(
  params?: SocialAccountQuery
): Promise<{ data: SocialAccountListResponse }> {
  return api.get('/v1/social-accounts', { params });
}

/**
 * Delete (unlink) a social account
 * DELETE /api/v1/social-accounts/:id
 */
export function deleteSocialAccount(id: string): Promise<void> {
  return api.delete(`/v1/social-accounts/${id}`);
}

/**
 * Get social account detail with user info and login history
 * GET /api/v1/social-accounts/:id/detail
 */
export function getSocialAccountDetail(id: string): Promise<{ data: SocialAccountDetail }> {
  return api.get(`/v1/social-accounts/${id}/detail`);
}

/**
 * Batch unlink social accounts
 * POST /api/v1/social-accounts/batch/unlink
 * Note: Maximum 50 accounts at once
 */
export function batchUnlinkSocialAccounts(ids: string[]): Promise<{ data: BatchOperationResult }> {
  return api.post('/v1/social-accounts/batch/unlink', { ids });
}
