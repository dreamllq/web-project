import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { UsersModule } from '../users/users.module';
import { JwtConfig } from '../config/jwt.config';

@Module({
  imports: [
    UsersModule,
    CacheModule.register(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const jwtConfig = configService.get<JwtConfig>('jwt') ?? {
          secret: 'your-secret-key-change-in-production',
          accessTokenExpiresIn: '15m',
          refreshTokenExpiresIn: '7d',
        };
        return {
          secret: jwtConfig.secret,
          signOptions: { expiresIn: jwtConfig.accessTokenExpiresIn },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
