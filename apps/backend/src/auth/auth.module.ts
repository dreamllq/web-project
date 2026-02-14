import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CacheModule } from '@nestjs/cache-manager';
import { HttpModule } from '@nestjs/axios';
import * as redisStore from 'cache-manager-redis-yet';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtConfig } from '../config/jwt.config';
import { WechatOAuthService } from './oauth/wechat.service';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
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
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => ({
        store: redisStore,
        // Redis connection configuration
        socket: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
        },
        password: process.env.REDIS_PASSWORD || undefined,
        ttl: 604800000, // Default TTL: 7 days in milliseconds
      }),
    }),
    HttpModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, WechatOAuthService],
  exports: [AuthService, JwtModule, WechatOAuthService],
})
export class AuthModule {}
