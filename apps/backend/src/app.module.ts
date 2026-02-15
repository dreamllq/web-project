import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'path';
import { databaseConfig } from './config/database.config';
import { jwtConfig } from './config/jwt.config';
import { wechatConfig } from './config/wechat.config';
import { wechatMiniprogramConfig } from './config/wechat-miniprogram.config';
import { dingtalkMiniprogramConfig } from './config/dingtalk-miniprogram.config';
import { AppI18nModule } from './i18n/i18n.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PolicyModule } from './policy/policy.module';
import { AuditModule } from './audit/audit.module';
import { NotificationModule } from './notification/notification.module';
import { WebsocketModule } from './websocket/websocket.module';
import { FileModule } from './file/file.module';
import { OAuthModule } from './oauth/oauth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '../../../.env'),
        join(__dirname,'../../../.env.local'),
      ],
      load: [jwtConfig, wechatConfig, wechatMiniprogramConfig, dingtalkMiniprogramConfig],
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
    AuditModule,
    NotificationModule,
    WebsocketModule,
    FileModule,
    OAuthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
