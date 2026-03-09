import { IsArray, IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class BatchProviderIdsDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  ids: string[];
}

/**
 * DTO for updating provider metadata (display settings)
 */
export class UpdateProviderMetadataDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  displayName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  icon?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  color?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999)
  sortOrder?: number;
}

/**
 * Response interface for OAuth provider (without sensitive data)
 */
export interface OAuthProviderResponse {
  id: string;
  code: string;
  name: string;
  appId: string;
  redirectUri: string | null;
  enabled: boolean;
  displayName: string | null;
  icon: string | null;
  color: string | null;
  providerType: string | null;
  sortOrder: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response interface for provider metadata
 */
export interface ProviderMetadataResponse {
  code: string;
  displayName: string;
  icon: string;
  color: string;
  providerType: string;
  isEnabled: boolean;
}
