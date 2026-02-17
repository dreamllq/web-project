import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { join } from 'path';
import { MailService } from './mail.service';
import { MailConfig } from '../config/mail.config';

@Module({
  imports: [
    // mailConfig is already loaded globally in app.module.ts via registerAs('mail', ...)
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const mailConfigValue = configService.get<MailConfig>('mail');
        console.log('mailConfigValue', mailConfigValue);

        return {
          transport: {
            host: mailConfigValue?.host || 'localhost',
            port: mailConfigValue?.port || 587,
            secure: mailConfigValue?.secure || false,
            auth: mailConfigValue?.auth?.user
              ? {
                  user: mailConfigValue.auth.user,
                  pass: mailConfigValue.auth.pass,
                }
              : undefined,
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            rateLimit: 14,
          },
          defaults: {
            from: mailConfigValue?.from || 'noreply@example.com',
          },
          template: {
            dir: join(__dirname, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
