import api from './index';
import type {
  AdminUserResponse,
  AdminUserListResponse,
  UserQueryParams,
  CreateAdminUserDto,
  UpdateAdminUserDto,
} from '@/types/user';
import type { UserStatus } from '@/types/auth';

// ============================================
// Admin User Management API Functions
// ============================================

/**
 * Get paginated list of users (admin)
 * GET /api/v1/users
 */
export function getAdminUsers(query: UserQueryParams): Promise<{ data: AdminUserListResponse }> {
  return api.get('/v1/users', { params: query });
}

/**
 * Get a single user by ID (admin)
 * GET /api/v1/users/:id
 */
export function getAdminUser(id: string): Promise<{ data: AdminUserResponse }> {
  return api.get(`/v1/users/${id}`);
}

/**
 * Create a new user (admin)
 * POST /api/v1/users
 */
export function createAdminUser(dto: CreateAdminUserDto): Promise<{ data: AdminUserResponse }> {
  return api.post('/v1/users', dto);
}

/**
 * Update a user (admin)
 * PATCH /api/v1/users/:id
 */
export function updateAdminUser(
  id: string,
  dto: UpdateAdminUserDto
): Promise<{ data: AdminUserResponse }> {
  return api.patch(`/v1/users/${id}`, dto);
}

/**
 * Delete a user (admin, soft delete)
 * DELETE /api/v1/users/:id
 */
export function deleteAdminUser(
  id: string
): Promise<{ data: { success: boolean; message: string } }> {
  return api.delete(`/v1/users/${id}`);
}

/**
 * Update user status (admin)
 * PATCH /api/v1/users/:id/status
 */
export function updateUserStatus(
  id: string,
  status: UserStatus
): Promise<{ data: AdminUserResponse }> {
  return api.patch(`/v1/users/${id}/status`, { status });
}
