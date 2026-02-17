import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

// Supported locales
const SUPPORTED_LOCALES = ['zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP', 'ko-KR'] as const;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Nickname must not exceed 100 characters' })
  nickname?: string;

  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_LOCALES, { message: 'Unsupported locale' })
  locale?: string;
}
