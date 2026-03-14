import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EditMessageDto {
  @ApiProperty({
    description: 'New message content',
    minLength: 1,
    maxLength: 10000,
    example: 'Hello, world!',
  })
  @IsString({ message: 'Content must be a string' })
  @IsNotEmpty({ message: 'Content is required' })
  @MinLength(1, { message: 'Content must be at least 1 character' })
  @MaxLength(10000, { message: 'Content must not exceed 10000 characters' })
  content: string;
}
