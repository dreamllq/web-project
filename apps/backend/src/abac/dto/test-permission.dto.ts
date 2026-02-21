import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class TestPermissionDto {
  @ApiProperty({
    description: 'User ID to test permissions for',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({
    description: 'Resource to check access to',
    example: 'user',
  })
  @IsString()
  @IsNotEmpty()
  resource: string;

  @ApiProperty({
    description: 'Action to check permission for',
    example: 'read',
  })
  @IsString()
  @IsNotEmpty()
  action: string;
}
