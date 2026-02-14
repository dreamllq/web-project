export interface JwtConfig {
  secret: string;
  accessTokenExpiresIn: string;
  refreshTokenExpiresIn: string;
}

export const jwtConfig = (): JwtConfig => ({
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
  accessTokenExpiresIn: '15m',
  refreshTokenExpiresIn: '7d',
});

export default jwtConfig;
