import { IsString, IsOptional, IsArray, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty({ message: 'Role name is required' })
  @MaxLength(50, { message: 'Role name must not exceed 50 characters' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @IsOptional()
  @IsArray({ message: 'Permission IDs must be an array' })
  @IsString({ each: true, message: 'Each permission ID must be a string' })
  permissionIds?: string[];
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MaxLength(50, { message: 'Role name must not exceed 50 characters' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  description?: string;

  @IsOptional()
  @IsArray({ message: 'Permission IDs must be an array' })
  @IsString({ each: true, message: 'Each permission ID must be a string' })
  permissionIds?: string[];
}

export class AssignRoleDto {
  @IsString()
  @IsNotEmpty({ message: 'Role ID is required' })
  roleId: string;
}

export class AssignPermissionsDto {
  @IsArray({ message: 'Permission IDs must be an array' })
  @IsString({ each: true, message: 'Each permission ID must be a string' })
  @IsNotEmpty({ message: 'At least one permission ID is required' })
  permissionIds: string[];
}
