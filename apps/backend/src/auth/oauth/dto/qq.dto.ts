import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for QQ OAuth authorization query parameters
 */
export class QQAuthDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * DTO for QQ OAuth callback query parameters
 */
export class QQCallbackDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * Response from QQ access token API
 *
 * CRITICAL: QQ token endpoint requires fmt=json parameter (defaults to JSONP)
 * Example: https://graph.qq.com/oauth2.0/token?fmt=json&grant_type=authorization_code&...
 */
export interface QQAccessTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
}

/**
 * Response from QQ OpenID API
 * Two-step userinfo: first get openid, then get user info
 */
export interface QQOpenIdResponse {
  client_id: string;
  openid: string;
  unionid?: string;
}

/**
 * Response from QQ userinfo API
 */
export interface QQUserInfo {
  openid: string;
  unionid?: string;
  nickname: string;
  figureurl_qq_1: string; // avatar URL (100x100)
  gender?: string;
}

/**
 * QQ authorization URL response
 */
export interface QQAuthUrlResponse {
  url: string;
}

/**
 * QQ OAuth error response
 */
export interface QQErrorResponse {
  error: string;
  error_description: string;
}
