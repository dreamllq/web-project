import { IsUUID, IsEnum, IsString, MaxLength, IsOptional, IsObject } from 'class-validator';
import { NotificationType } from '../../entities/notification.entity';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  content: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
