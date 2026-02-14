import { IsString, IsOptional, IsUrl, IsArray, IsEnum, IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Grant types supported by OAuth provider
 */
export enum GrantType {
  AUTHORIZATION_CODE = 'authorization_code',
  CLIENT_CREDENTIALS = 'client_credentials',
}

/**
 * OAuth client entity (stored in database)
 */
export interface OAuthClient {
  id: string;
  clientId: string;
  clientSecret: string;
  name: string;
  redirectUris: string[];
  scopes: string[];
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * OAuth authorization code (stored in cache)
 */
export interface OAuthAuthorizationCode {
  code: string;
  clientId: string;
  redirectUri: string;
  userId: string;
  scopes: string[];
  expiresAt: number;
}

/**
 * OAuth access token (stored in cache)
 */
export interface OAuthAccessToken {
  accessToken: string;
  clientId: string;
  userId?: string; // undefined for client_credentials
  scopes: string[];
  expiresAt: number;
}

/**
 * DTO for registering a new OAuth client
 */
export class RegisterClientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @IsUrl({}, { each: true })
  @IsNotEmpty()
  redirectUris: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  scopes?: string[];
}

/**
 * DTO for authorization endpoint query parameters
 */
export class AuthorizeDto {
  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsUrl()
  @IsNotEmpty()
  redirect_uri: string;

  @IsString()
  @IsOptional()
  scope?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  response_type?: string;
}

/**
 * DTO for token endpoint
 */
export class TokenDto {
  @IsEnum(GrantType)
  grant_type: GrantType;

  @IsString()
  @IsNotEmpty()
  client_id: string;

  @IsString()
  @IsNotEmpty()
  client_secret: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  redirect_uri?: string;

  @IsString()
  @IsOptional()
  scope?: string;
}

/**
 * Response for token endpoint
 */
export interface TokenEndpointResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/**
 * Response for userinfo endpoint
 */
export interface UserInfoResponse {
  sub: string;
  username: string;
  email?: string;
  phone?: string;
  nickname?: string;
  avatar_url?: string;
}

/**
 * Response for client registration
 */
export interface RegisterClientResponse {
  id: string;
  client_id: string;
  client_secret: string;
  name: string;
  redirect_uris: string[];
  scopes: string[];
  created_at: Date;
}
