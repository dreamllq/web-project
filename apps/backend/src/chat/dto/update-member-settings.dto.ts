import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMemberSettingsDto {
  @ApiPropertyOptional({ description: 'Whether to hide this room from the user list' })
  @IsBoolean()
  @IsOptional()
  isHidden?: boolean;
}
