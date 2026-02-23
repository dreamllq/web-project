import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsNumber,
  MaxLength,
  Min,
  ValidateNested,
  IsArray,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PolicyEffect } from '../../entities/policy.entity';
import type { SubjectDefinition, ConditionExpression } from '../types/policy.types';

/**
 * DTO for PolicySubject validation
 */
export class PolicySubjectDto implements SubjectDefinition {
  @IsEnum(['role', 'user', 'department', 'all'], {
    message: 'Subject type must be one of: role, user, department, all',
  })
  type: 'role' | 'user' | 'department' | 'all';

  @ValidateIf((o: PolicySubjectDto) => o.type !== 'all')
  @IsNotEmpty({ message: 'Subject value is required when type is not "all"' })
  @IsArray({
    message: 'Subject value must be an array of IDs when type is not "all"',
  })
  @IsString({ each: true, message: 'Each subject value must be a string' })
  value: string | string[];
}

/**
 * DTO for single condition validation
 */
export class ConditionDto {
  @IsString()
  @IsNotEmpty({ message: 'Condition field is required' })
  field: string;

  @IsEnum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'nin', 'like', 'isNull'], {
    message: 'Invalid condition operator',
  })
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'like' | 'isNull';

  value: string | number | boolean | null | string[];

  @IsOptional()
  @IsEnum(['literal', 'userAttr', 'env'], {
    message: 'Value type must be one of: literal, userAttr, env',
  })
  valueType?: 'literal' | 'userAttr' | 'env';
}

/**
 * DTO for condition expression validation (AND only, max 3 conditions)
 */
export class ConditionExpressionDto implements ConditionExpression {
  @ValidateIf((o: ConditionExpressionDto) => !o.condition)
  @IsArray({ message: 'Conditions must be an array' })
  @ValidateNested({ each: true })
  @Type(() => ConditionDto)
  and?: ConditionDto[];

  @ValidateIf((o: ConditionExpressionDto) => !o.and)
  @ValidateNested()
  @Type(() => ConditionDto)
  condition?: ConditionDto;
}

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

  @ValidateNested()
  @Type(() => PolicySubjectDto)
  subject: PolicySubjectDto;

  @IsString()
  @IsNotEmpty({ message: 'Resource is required' })
  @MaxLength(255)
  resource: string;

  @IsString()
  @IsNotEmpty({ message: 'Action is required' })
  @MaxLength(100)
  action: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConditionExpressionDto)
  conditions?: ConditionExpressionDto;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
