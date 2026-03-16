import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePrivateRoomDto {
  @ApiProperty({ description: 'Target user ID to create private room with' })
  @IsUUID()
  @IsNotEmpty()
  targetUserId: string;
}
