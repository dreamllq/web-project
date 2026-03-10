import { IsString, IsOptional, IsBoolean, IsInt, Min, IsArray, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for querying OAuth tokens
 */
export class OAuthTokenQueryDto {
  @ApiPropertyOptional({ description: 'Filter by client ID' })
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by revoked status' })
  @Type(() => Boolean)
  @IsOptional()
  @IsBoolean()
  revoked?: boolean;

  @ApiPropertyOptional({ description: 'Number of results per page', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Offset for pagination', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}

/**
 * DTO for batch revoke tokens
 */
export class BatchRevokeTokensDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  ids: string[];
}

/**
 * Response interface for OAuth token
 */
export interface OAuthTokenResponse {
  id: string;
  clientId: string;
  userId: string | null;
  accessToken: string;
  scopes: string[];
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Response interface for token list
 */
export interface OAuthTokenListResponse {
  data: OAuthTokenResponse[];
  total: number;
}

/**
 * Response interface for batch operation
 */
export interface BatchOperationResult {
  success: string[];
  failed: string[];
  errors: string[];
}

/**
 * Query DTO for exporting OAuth tokens
 */
export class ExportTokensQueryDto extends OAuthTokenQueryDto {
  @IsOptional()
  @IsString()
  format?: 'csv' | 'json';

  @IsOptional()
  @IsBoolean()
  includeUserPII?: boolean;
}

/**
 * Response interface for JSON export
 */
export interface ExportTokensJsonResponse {
  data: Array<{
    id: string;
    clientId: string;
    userId: string | null;
    accessToken: string;
    scopes: string[];
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    user?: {
      id: string;
      username: string;
      email: string | null;
    };
  }>;
  total: number;
  exportedAt: string;
}
