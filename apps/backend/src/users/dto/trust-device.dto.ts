import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for trusting a device
 * deviceId comes from URL path parameter
 * Body is optional but can include metadata
 */
export class TrustDeviceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'Note must not exceed 200 characters' })
  note?: string;
}
