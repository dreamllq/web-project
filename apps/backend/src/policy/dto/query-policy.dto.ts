import { IsOptional, IsString, IsBoolean, IsNumber, IsEnum, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryPolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['role', 'user', 'department', 'all'], {
    message: 'Subject type must be one of: role, user, department, all',
  })
  subjectType?: 'role' | 'user' | 'department' | 'all';

  @IsOptional()
  @IsString()
  resource?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  @Min(1)
  limit?: number;
}
