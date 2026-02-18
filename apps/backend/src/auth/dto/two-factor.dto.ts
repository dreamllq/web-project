import { IsString, IsNotEmpty, Length, MinLength, IsArray } from 'class-validator';

export class ConfirmTwoFactorDto {
  @IsString()
  @IsNotEmpty({ message: 'Secret is required' })
  secret: string;

  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  code: string;

  @IsArray({ message: 'Recovery codes must be an array' })
  @IsString({ each: true, message: 'Each recovery code must be a string' })
  recoveryCodes: string[];
}

export class VerifyTwoFactorDto {
  @IsString()
  @IsNotEmpty({ message: 'Temporary token is required' })
  tempToken: string;

  @IsString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  code: string;
}

export class RecoveryCodeDto {
  @IsString()
  @IsNotEmpty({ message: 'Temporary token is required' })
  tempToken: string;

  @IsString()
  @MinLength(8, { message: 'Recovery code must be at least 8 characters' })
  recoveryCode: string;
}

export class DisableTwoFactorDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}

export class RegenerateCodesDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password: string;
}
