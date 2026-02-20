import { IsString, IsOptional, IsArray, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  @MaxLength(50)
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}

export class AssignRoleDto {
  @IsString()
  @IsNotEmpty()
  roleId: string;
}
