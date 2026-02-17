import type { User, UserStatus } from './auth';

// Re-export User types for convenience
export type { User, UserStatus };

/**
 * DTO for updating user profile
 */
export interface UpdateProfileDto {
  nickname?: string;
  locale?: string;
}

/**
 * DTO for changing password
 */
export interface ChangePasswordDto {
  oldPassword: string;
  newPassword: string;
}

/**
 * DTO for resetting password with token
 */
export interface ResetPasswordDto {
  token: string;
  newPassword: string;
}

/**
 * DTO for forgot password request
 */
export interface ForgotPasswordDto {
  email: string;
}

/**
 * User profile response from API
 * Matches backend UserProfileResponse interface
 */
export interface UserProfileResponse {
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
}

/**
 * Response wrapper for update profile API
 */
export interface UpdateProfileResponse {
  success: boolean;
  user: UserProfileResponse;
}

/**
 * Response wrapper for change password API
 */
export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

/**
 * Response wrapper for generic success responses
 */
export interface GenericSuccessResponse {
  success: boolean;
  message: string;
}
