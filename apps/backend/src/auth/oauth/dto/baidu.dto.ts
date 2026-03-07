import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for Baidu OAuth authorization URL query parameters
 */
export class BaiduAuthDto {
  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * DTO for Baidu OAuth callback query parameters
 */
export class BaiduCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * Response from Baidu access token API
 */
export interface BaiduAccessTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
}

/**
 * Response from Baidu userinfo API
 *
 * CRITICAL: When calling userinfo endpoint, must add `get_unionid=1` parameter:
 * https://openapi.baidu.com/rest/2.0/passport/users/getInfo?get_unionid=1
 *
 * Avatar URL construction: https://himg.bdimg.com/sys/portrait/item/{portrait}
 */
export interface BaiduUserInfo {
  openid: string;
  unionid?: string;
  username: string;
  portrait: string; // avatar code, construct URL: https://himg.bdimg.com/sys/portrait/item/{portrait}
  sex?: string;
}

/**
 * Baidu authorization URL response
 */
export interface BaiduAuthUrlResponse {
  url: string;
}

/**
 * Baidu OAuth error response
 */
export interface BaiduErrorResponse {
  error: string;
  error_description: string;
}
