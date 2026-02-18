import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for removing a device
 * deviceId comes from URL path parameter
 * Body is optional but can include metadata
 */
export class RemoveDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Reason must not exceed 200 characters' })
  reason?: string;
}
