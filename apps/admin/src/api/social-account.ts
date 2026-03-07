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
