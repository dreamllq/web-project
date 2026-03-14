import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType } from '../../entities/room.entity';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Room type',
    enum: RoomType,
    example: RoomType.GROUP,
  })
  @IsEnum(RoomType, { message: 'Invalid room type' })
  @IsNotEmpty({ message: 'Room type is required' })
  type: RoomType;

  @ApiPropertyOptional({
    description: 'Room name (required for group/broadcast rooms)',
    maxLength: 100,
    example: 'Team Discussion',
  })
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @MinLength(1, { message: 'Name must be at least 1 character' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Room avatar URL',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Avatar must be a string' })
  @MaxLength(500, { message: 'Avatar must not exceed 500 characters' })
  avatar?: string;

  @ApiPropertyOptional({
    description: 'Initial member IDs (for group rooms)',
    type: [String],
    example: ['uuid-1', 'uuid-2'],
  })
  @IsOptional()
  @IsUUID('4', { each: true, message: 'Each member ID must be a valid UUID' })
  memberIds?: string[];
}
