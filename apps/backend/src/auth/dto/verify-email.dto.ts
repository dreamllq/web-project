import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Verify Email DTO
 *
 * Used for the POST /api/v1/auth/verify-email/confirm endpoint
 * to confirm email verification with a token.
 */
export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty({ message: 'Verification token is required' })
  token: string;
}
