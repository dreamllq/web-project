import { IsString, IsOptional, IsArray, IsNotEmpty, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({ description: 'Permission name (e.g., user:create)', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ description: 'Resource name (e.g., user)', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  resource: string;

  @ApiProperty({ description: 'Action name (e.g., create)', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  action: string;

  @ApiPropertyOptional({ description: 'Permission description', maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: 'Policy IDs to associate with this permission',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  policyIds?: string[];
}

export class UpdatePermissionDto {
  @ApiPropertyOptional({ description: 'Permission name', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Resource name', maxLength: 100 })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  resource?: string;

  @ApiPropertyOptional({ description: 'Action name', maxLength: 50 })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  action?: string;

  @ApiPropertyOptional({ description: 'Permission description', maxLength: 255 })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @ApiPropertyOptional({
    description: 'Policy IDs to associate with this permission (replaces existing)',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  policyIds?: string[];
}
