import api from './index';
import type {
  UserProfileResponse,
  UpdateProfileDto,
  ChangePasswordDto,
  ResetPasswordDto,
  ForgotPasswordDto,
  DeviceListResponse,
  TrustDeviceResponse,
  LoginHistoryQuery,
  LoginHistoryResponse,
  AvatarUploadResponse,
  TwoFactorStatusResponse,
  TwoFactorSetupResponse,
  TwoFactorEnableDto,
  TwoFactorEnableResponse,
  VerifyPhoneDto,
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

/**
 * Get user devices
 * GET /api/v1/users/me/devices
 */
export function getDevices(): Promise<{ data: DeviceListResponse }> {
  return api.get('/v1/users/me/devices');
}

/**
 * Trust a device
 * POST /api/v1/users/me/devices/:deviceId/trust
 */
export function trustDevice(deviceId: string): Promise<{ data: TrustDeviceResponse }> {
  return api.post(`/v1/users/me/devices/${deviceId}/trust`);
}

/**
 * Remove a device
 * DELETE /api/v1/users/me/devices/:deviceId
 */
export function removeDevice(deviceId: string): Promise<void> {
  return api.delete(`/v1/users/me/devices/${deviceId}`);
}

/**
 * Get login history
 * GET /api/v1/users/me/login-history
 */
export function getLoginHistory(query: LoginHistoryQuery): Promise<{ data: LoginHistoryResponse }> {
  return api.get('/v1/users/me/login-history', { params: query });
}

/**
 * Upload avatar
 * POST /api/v1/users/me/avatar
 */
export function uploadAvatar(file: File): Promise<{ data: AvatarUploadResponse }> {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/v1/users/me/avatar', formData);
}

// ============================================
// Two-Factor Authentication (2FA) Functions
// ============================================

/**
 * Get 2FA status
 * GET /api/v1/users/me/2fa/status
 */
export function getTwoFactorStatus(): Promise<{ data: TwoFactorStatusResponse }> {
  return api.get('/v1/users/me/2fa/status');
}

/**
 * Setup 2FA (generate QR code and secret)
 * POST /api/v1/users/me/2fa/setup
 */
export function setupTwoFactor(): Promise<{ data: TwoFactorSetupResponse }> {
  return api.post('/v1/users/me/2fa/setup');
}

/**
 * Enable 2FA after verifying code
 * POST /api/v1/users/me/2fa/enable
 */
export function enableTwoFactor(
  data: TwoFactorEnableDto
): Promise<{ data: TwoFactorEnableResponse }> {
  return api.post('/v1/users/me/2fa/enable', data);
}

/**
 * Disable 2FA
 * POST /api/v1/users/me/2fa/disable
 */
export function disableTwoFactor(): Promise<{ data: { success: boolean; message: string } }> {
  return api.post('/v1/users/me/2fa/disable');
}

/**
 * Regenerate recovery codes
 * POST /api/v1/users/me/2fa/regenerate-codes
 */
export function regenerateRecoveryCodes(): Promise<{
  data: { success: boolean; recoveryCodes: string[] };
}> {
  return api.post('/v1/users/me/2fa/regenerate-codes');
}

// ============================================
// Phone Verification Functions
// ============================================

/**
 * Send phone verification code
 * POST /api/v1/users/me/phone/send-verification
 */
export function sendPhoneVerification(
  phone: string
): Promise<{ data: { success: boolean; message: string } }> {
  return api.post('/v1/users/me/phone/send-verification', { phone });
}

/**
 * Verify phone with code
 * POST /api/v1/users/me/phone/verify
 */
export function verifyPhone(data: VerifyPhoneDto): Promise<{ data: { success: boolean } }> {
  return api.post('/v1/users/me/phone/verify', data);
}
