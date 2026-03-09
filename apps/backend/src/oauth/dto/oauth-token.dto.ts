import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

/**
 * DTO for querying OAuth tokens
 */
export class OAuthTokenQueryDto {
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsBoolean()
  revoked?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;
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
