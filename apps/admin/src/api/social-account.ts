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

export interface SocialAccountLoginHistory {
  timestamp: string;
  ip: string;
  userAgent?: string;
}

export interface SocialAccountDetail {
  id: string;
  userId: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
  provider: string;
  providerUserId: string;
  providerData?: Record<string, unknown>;
  loginHistory?: SocialAccountLoginHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface BatchUnlinkResponse {
  success: string[];
  failed: string[];
  errors: string[];
}

// ============================================
// API Functions
// ============================================

/**
 * Get list of social accounts
 * GET /api/admin/social-accounts
 */
export function getSocialAccounts(
  params?: SocialAccountQuery
): Promise<{ data: SocialAccountListResponse }> {
  return api.get('/admin/social-accounts', { params });
}

/**
 * Delete (unlink) a social account
 * DELETE /api/admin/social-accounts/:id
 */
export function deleteSocialAccount(id: string): Promise<void> {
  return api.delete(`/admin/social-accounts/${id}`);
}

/**
 * Batch unlink social accounts
 * POST /api/admin/social-accounts/batch/unlink
 */
export function batchUnlinkSocialAccounts(ids: string[]): Promise<{ data: BatchUnlinkResponse }> {
  return api.post('/admin/social-accounts/batch/unlink', { ids });
}

/**
 * Get social account detail
 * GET /api/admin/social-accounts/:id/detail
 */
export function getSocialAccountDetail(id: string): Promise<{ data: SocialAccountDetail }> {
  return api.get(`/admin/social-accounts/${id}/detail`);
}
