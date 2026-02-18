export type UserStatus = 'active' | 'disabled' | 'pending';

export interface User {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  nickname: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  locale: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  roles?: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// ============================================
// Two-Factor Authentication Types
// ============================================

/**
 * 2FA status for the current user
 */
export interface TwoFactorStatus {
  enabled: boolean;
  verifiedAt: string | null;
}

/**
 * Response from 2FA setup API
 * Contains TOTP secret, QR code URL, and recovery codes
 */
export interface TwoFactorSetupResponse {
  secret: string;
  qrCodeUrl: string;
  recoveryCodes: string[];
}

/**
 * DTO for enabling 2FA
 * Requires the TOTP verification code
 */
export interface TwoFactorEnableDto {
  code: string;
}

/**
 * DTO for verifying 2FA code during login
 */
export interface TwoFactorVerifyDto {
  code: string;
}

/**
 * DTO for disabling 2FA
 * Requires the TOTP verification code for security
 */
export interface TwoFactorDisableDto {
  code: string;
}

/**
 * Response wrapper for 2FA status API
 */
export interface TwoFactorStatusResponse {
  data: TwoFactorStatus;
}

/**
 * Response wrapper for 2FA verify during login
 */
export interface TwoFactorLoginResponse {
  token: string;
  user: User;
}

/**
 * Response wrapper for 2FA enable API
 * Returns success status and recovery codes
 */
export interface TwoFactorEnableResponse {
  success: boolean;
  message: string;
  recoveryCodes?: string[];
}

// ============================================
// Phone Verification Types
// ============================================

/**
 * DTO for sending phone verification code
 */
export interface SendPhoneVerificationDto {
  phone: string;
}

/**
 * DTO for verifying phone number
 */
export interface VerifyPhoneDto {
  code: string;
}

/**
 * Response wrapper for phone verification APIs
 */
export interface PhoneVerificationResponse {
  success: boolean;
  message: string;
}
