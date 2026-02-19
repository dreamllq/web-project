import type { User, UserStatus } from './auth';
import type {
  TwoFactorStatusResponse,
  TwoFactorSetupResponse,
  TwoFactorEnableDto,
  TwoFactorEnableResponse,
  VerifyPhoneDto,
} from './auth';
import type { Role } from './rbac';

// Re-export User types for convenience
export type { User, UserStatus };

// Re-export 2FA types for convenience
export type {
  TwoFactorStatusResponse,
  TwoFactorSetupResponse,
  TwoFactorEnableDto,
  TwoFactorEnableResponse,
  VerifyPhoneDto,
};

/**
 * Storage URL response type
 * Supports multiple storage backends: local (direct URL), s3/minio (key + signed URL)
 */
export interface StorageUrlResponse {
  type: 'local' | 's3' | 'minio';
  key?: string;
  url?: string;
}

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
  avatar: StorageUrlResponse;
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

// ============================================
// Device Management Types
// ============================================

/**
 * User device information
 */
export interface UserDevice {
  id: string;
  deviceName: string;
  userAgent: string;
  ipAddress: string;
  trusted: boolean;
  lastUsedAt: string;
  createdAt: string;
}

/**
 * Response wrapper for device list API
 */
export interface DeviceListResponse {
  data: UserDevice[];
}

/**
 * Response wrapper for trust device API
 */
export interface TrustDeviceResponse {
  success: boolean;
  message: string;
  device: UserDevice;
}

// ============================================
// Login History Types
// ============================================

/**
 * Single login history record
 */
export interface LoginHistoryItem {
  id: string;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint: string;
  loginMethod: string;
  success: boolean;
  failureReason: string | null;
  createdAt: string;
}

/**
 * Query parameters for login history API
 */
export interface LoginHistoryQuery {
  limit?: number;
  offset?: number;
  success?: boolean;
  startDate?: string;
  endDate?: string;
}

/**
 * Response wrapper for login history API
 */
export interface LoginHistoryResponse {
  data: LoginHistoryItem[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

// ============================================
// Avatar Upload Types
// ============================================

/**
 * Response wrapper for avatar upload API
 */
export interface AvatarUploadResponse {
  success: boolean;
  avatar: StorageUrlResponse;
}

// ============================================
// Admin User Management Types
// ============================================

/**
 * Admin user response with full details
 */
export interface AdminUserResponse {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  nickname: string | null;
  avatar: StorageUrlResponse;
  status: UserStatus;
  locale: string;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  updatedAt: string;
  roles?: Role[];
}

/**
 * Paginated admin user list response
 */
export interface AdminUserListResponse {
  data: AdminUserResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * DTO for creating a new user (admin)
 */
export interface CreateAdminUserDto {
  username: string;
  password: string;
  email?: string;
  phone?: string;
  nickname?: string;
  status?: UserStatus;
}

/**
 * DTO for updating a user (admin)
 */
export interface UpdateAdminUserDto {
  email?: string;
  phone?: string;
  nickname?: string;
  status?: UserStatus;
}

/**
 * Query parameters for user list
 */
export interface UserQueryParams {
  keyword?: string;
  status?: UserStatus;
  limit?: number;
  offset?: number;
}

/**
 * DTO for batch assigning roles to users
 */
export interface BatchAssignRolesDto {
  userIds: string[];
  roleIds: string[];
}

/**
 * Response for batch role assignment
 */
export interface BatchAssignRolesResponse {
  success: boolean;
  message: string;
  assignedCount: number;
}
