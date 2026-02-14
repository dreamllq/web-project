import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsObject,
  MaxLength,
  Min,
} from 'class-validator';
import { PolicyEffect } from '../../entities/policy.entity';

export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty({ message: 'Policy name is required' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(PolicyEffect, { message: 'Effect must be either allow or deny' })
  effect: PolicyEffect;

  @IsString()
  @IsNotEmpty({ message: 'Subject is required' })
  @MaxLength(255)
  subject: string;

  @IsString()
  @IsNotEmpty({ message: 'Resource is required' })
  @MaxLength(255)
  resource: string;

  @IsString()
  @IsNotEmpty({ message: 'Action is required' })
  @MaxLength(100)
  action: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
