import api from './index';
import type {
  UserProfileResponse,
  UpdateProfileDto,
  ChangePasswordDto,
  ResetPasswordDto,
  ForgotPasswordDto,
} from '@/types/user';

/**
 * Get current user profile
 * GET /api/v1/users/me
 */
export function getCurrentUser(): Promise<{ data: UserProfileResponse }> {
  return api.get('/v1/users/me');
}

/**
 * Update user profile
 * PATCH /api/v1/users/me
 */
export function updateProfile(
  data: UpdateProfileDto
): Promise<{ data: { success: boolean; user: UserProfileResponse } }> {
  return api.patch('/v1/users/me', data);
}

/**
 * Change password
 * PATCH /api/v1/users/me/password
 */
export function changePassword(
  data: ChangePasswordDto
): Promise<{ data: { success: boolean; message: string } }> {
  return api.patch('/v1/users/me/password', data);
}

/**
 * Delete account (soft delete)
 * DELETE /api/v1/users/me
 */
export function deleteAccount(): Promise<{ data: { success: boolean; message: string } }> {
  return api.delete('/v1/users/me');
}

/**
 * Request password reset email
 * POST /api/v1/auth/forgot-password
 */
export function forgotPassword(
  data: ForgotPasswordDto
): Promise<{ data: { success: boolean; message: string } }> {
  return api.post('/v1/auth/forgot-password', data);
}

/**
 * Reset password with token
 * POST /api/v1/auth/reset-password
 */
export function resetPassword(
  data: ResetPasswordDto
): Promise<{ data: { success: boolean; message: string } }> {
  return api.post('/v1/auth/reset-password', data);
}

/**
 * Request email verification
 * POST /api/v1/auth/verify-email/request
 */
export function requestEmailVerification(): Promise<{
  data: { success: boolean; message: string };
}> {
  return api.post('/v1/auth/verify-email/request');
}
