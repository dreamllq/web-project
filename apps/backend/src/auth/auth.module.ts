import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomCacheModule } from '../custom-cache/custom-cache.module';
import { MailModule } from '../mail/mail.module';
import { SmsModule } from '../sms/sms.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtConfig } from '../config/jwt.config';
import { WechatOAuthService } from './oauth/wechat.service';
import { WechatMiniprogramService } from './oauth/wechat-miniprogram.service';
import { DingtalkMiniprogramService } from './oauth/dingtalk-miniprogram.service';
import { VerificationTokenService } from './services/verification-token.service';
import { VerificationToken } from '../entities/verification-token.entity';
import { TwoFactorService } from './services/two-factor.service';
import { TotpService } from './services/totp.service';
import { RecoveryCodeService } from './services/recovery-code.service';

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([VerificationToken]),
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
    CustomCacheModule,
    HttpModule,
    MailModule,
    SmsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    WechatOAuthService,
    WechatMiniprogramService,
    DingtalkMiniprogramService,
    VerificationTokenService,
    TotpService,
    RecoveryCodeService,
    TwoFactorService,
  ],
  exports: [
    AuthService,
    JwtModule,
    WechatOAuthService,
    WechatMiniprogramService,
    DingtalkMiniprogramService,
    VerificationTokenService,
    TotpService,
    RecoveryCodeService,
    TwoFactorService,
  ],
})
export class AuthModule {}
