import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { mailConfig } from './config/mail.config';
import { wechatConfig } from './config/wechat.config';
import { wechatMiniprogramConfig } from './config/wechat-miniprogram.config';
import { dingtalkMiniprogramConfig } from './config/dingtalk-miniprogram.config';
import { AppI18nModule } from './i18n/i18n.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PolicyModule } from './policy/policy.module';
import { RbacModule } from './rbac/rbac.module';
import { AuditModule } from './audit/audit.module';
import { NotificationModule } from './notification/notification.module';
import { WebsocketModule } from './websocket/websocket.module';
import { FileModule } from './file/file.module';
import { OAuthModule } from './oauth/oauth.module';
import { InitModule } from './init/init.module';
import { MailModule } from './mail/mail.module';
import { storageConfig } from './config/storage.config';

@Module({
  imports: [
    // Rate limiting configuration
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute (default)
      },
      {
        name: 'medium',
        ttl: 3600000, // 1 hour
        limit: 100, // 100 requests per hour
      },
      {
        name: 'long',
        ttl: 86400000, // 24 hours
        limit: 100, // 100 requests per day
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, '../../../.env'), join(__dirname, '../../../.env.local')],
      load: [
        jwtConfig,
        mailConfig,
        wechatConfig,
        wechatMiniprogramConfig,
        dingtalkMiniprogramConfig,
        storageConfig,
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: () => {
        return databaseConfig();
      },
    }),
    AppI18nModule,
    AuthModule,
    UsersModule,
    PolicyModule,
    RbacModule,
    AuditModule,
    NotificationModule,
    WebsocketModule,
    FileModule,
    OAuthModule,
    InitModule,
    MailModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
