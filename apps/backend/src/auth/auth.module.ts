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
import { WechatMiniprogramService } from './oauth/wechat-miniprogram.service';
import { DingtalkMiniprogramService } from './oauth/dingtalk-miniprogram.service';

@Module({
  imports: [
    ConfigModule,
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
        // Convert string expiresIn to number (seconds)
        // Default: 15 minutes = 900 seconds
        let expiresInSeconds = 900;
        const expiresInStr = jwtConfig.accessTokenExpiresIn;
        if (typeof expiresInStr === 'string') {
          const num = parseInt(expiresInStr.replace(/\D/g, ''), 10);
          if (!isNaN(num)) {
            if (expiresInStr.includes('h')) {
              expiresInSeconds = num * 3600;
            } else if (expiresInStr.includes('d')) {
              expiresInSeconds = num * 86400;
            } else {
              expiresInSeconds = num * 60; // assume minutes
            }
          }
        }
        return {
          secret: jwtConfig.secret,
          signOptions: { expiresIn: expiresInSeconds },
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
  providers: [
    AuthService,
    JwtStrategy,
    WechatOAuthService,
    WechatMiniprogramService,
    DingtalkMiniprogramService,
  ],
  exports: [
    AuthService,
    JwtModule,
    WechatOAuthService,
    WechatMiniprogramService,
    DingtalkMiniprogramService,
  ],
})
export class AuthModule {}
