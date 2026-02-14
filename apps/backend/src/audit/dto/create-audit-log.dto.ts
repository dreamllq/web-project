import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateAuditLogDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  @MaxLength(100)
  action: string;

  @IsString()
  @MaxLength(50)
  resourceType: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceId?: string;

  @IsString()
  @MaxLength(45)
  ipAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;

  @IsOptional()
  @IsObject()
  requestData?: Record<string, unknown>;

  @IsNumber()
  responseStatus: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  errorMessage?: string;
}
