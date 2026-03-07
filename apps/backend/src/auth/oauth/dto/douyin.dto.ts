import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for Douyin OAuth authorization query parameters
 */
export class DouyinAuthDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * DTO for Douyin OAuth callback query parameters
 */
export class DouyinCallbackDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * Response from Douyin access token API
 *
 * IMPORTANT: Douyin requires HTTPS for redirect_uri parameter
 */
export interface DouyinAccessTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  open_id: string;
  scope: string;
}

/**
 * Response from Douyin userinfo API
 */
export interface DouyinUserInfo {
  open_id: string;
  union_id: string;
  nickname: string;
  avatar: string;
  city?: string;
  province?: string;
  country?: string;
}

/**
 * Douyin authorization URL response
 */
export interface DouyinAuthUrlResponse {
  url: string;
}

/**
 * Douyin OAuth error response
 */
export interface DouyinErrorResponse {
  errcode: number;
  errmsg: string;
}
