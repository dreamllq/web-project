import {
  IsOptional,
  IsEnum,
  IsUUID,
  IsString,
  Min,
  Max,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SocialProvider } from '../../entities/social-provider.enum';

export class SocialAccountQueryDto {
  @IsOptional()
  @IsEnum(SocialProvider)
  provider?: SocialProvider;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;
}

export class BatchUnlinkDto {
  @IsArray()
  @IsUUID('all', { each: true })
  @ArrayMaxSize(50, { message: 'Cannot unlink more than 50 accounts at once' })
  ids: string[];
}

export interface BatchOperationResult {
  success: string[];
  failed: string[];
  errors: string[];
}

export interface SocialAccountDetail {
  id: string;
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  providerData: Record<string, unknown> | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    username: string;
    email: string | null;
  };
  loginHistory: {
    lastLoginAt: Date | null;
    lastLoginIp: string | null;
    loginCount: number;
  };
}
