import {
  IsArray,
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { OAuthProviderCode } from '../../entities/oauth-provider-config.entity';

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

/**
 * DTO for creating a new OAuth provider configuration
 */
export class CreateProviderDto {
  @IsEnum(OAuthProviderCode, { message: 'Invalid OAuth provider code' })
  @IsNotEmpty({ message: 'Provider code is required' })
  code: OAuthProviderCode;

  @IsString()
  @IsNotEmpty({ message: 'Configuration name is required' })
  @MaxLength(100, { message: 'Configuration name must not exceed 100 characters' })
  configName: string;

  @IsString()
  @IsNotEmpty({ message: 'App ID is required' })
  appId: string;

  @IsString()
  @IsNotEmpty({ message: 'App secret is required' })
  appSecret: string;

  @IsOptional()
  @IsString()
  redirectUri?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Display name must not exceed 50 characters' })
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Icon must not exceed 50 characters' })
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Color must not exceed 20 characters' })
  color?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
