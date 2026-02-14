import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Refresh Token DTO
 *
 * Used for the POST /api/auth/refresh endpoint
 * to request new access and refresh tokens.
 */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'Refresh token is required' })
  refresh_token: string;
}
