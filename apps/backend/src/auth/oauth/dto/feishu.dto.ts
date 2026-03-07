import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * DTO for Feishu OAuth authorization URL query parameters
 */
export class FeishuAuthDto {
  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * DTO for Feishu OAuth callback query parameters
 */
export class FeishuCallbackDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsString()
  state?: string;
}

/**
 * Response from Feishu access token API
 */
export interface FeishuAccessTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
}

/**
 * Response from Feishu userinfo API
 */
export interface FeishuUserInfo {
  open_id: string;
  union_id: string;
  name: string;
  avatar_url: string;
  mobile?: string;
  email?: string;
}
