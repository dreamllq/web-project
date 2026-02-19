import { IsString, IsOptional, IsEmail, IsEnum, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../../entities/user.entity';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ description: 'Email address', example: 'john@example.com' })
  @IsString()
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+1234567890' })
  @IsString()
  @IsOptional()
  @MaxLength(20, { message: 'Phone must not exceed 20 characters' })
  phone?: string;

  @ApiPropertyOptional({ description: 'Display name', example: 'John Doe' })
  @IsString()
  @IsOptional()
  @MaxLength(100, { message: 'Nickname must not exceed 100 characters' })
  nickname?: string;

  @ApiPropertyOptional({
    description: 'User status',
    enum: UserStatus,
    example: UserStatus.ACTIVE,
  })
  @IsEnum(UserStatus, { message: 'Invalid status value' })
  @IsOptional()
  status?: UserStatus;
}
