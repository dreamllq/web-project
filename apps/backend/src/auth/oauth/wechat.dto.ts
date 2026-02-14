import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for WeChat OAuth authorization URL query parameters
 */
export class WechatOAuthUrlDto {
  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * DTO for WeChat OAuth callback query parameters
 */
export class WechatOAuthCallbackDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * Response from WeChat access token API
 */
export interface WeChatAccessTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  openid: string;
  scope: string;
  unionid?: string;
}

/**
 * Response from WeChat userinfo API
 */
export interface WeChatUserInfo {
  openid: string;
  nickname: string;
  sex: number;
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  unionid?: string;
}

/**
 * WeChat authorization URL response
 */
export interface WeChatAuthUrlResponse {
  url: string;
}

/**
 * WeChat OAuth error response
 */
export interface WeChatErrorResponse {
  errcode: number;
  errmsg: string;
}
