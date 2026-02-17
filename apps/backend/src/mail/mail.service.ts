import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import { MailOptions } from './interfaces/mail.interface';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly baseUrl: string;
  private readonly verificationExpiresIn = '24 hours';
  private readonly resetExpiresIn = '1 hour';

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService
  ) {
    this.baseUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  /**
   * Send a verification email to a user
   */
  async sendVerificationEmail(to: string, token: string, username: string): Promise<void> {
    this.logger.log(`Sending verification email to: ${this.maskEmail(to)}`);

    try {
      await this.mailerService.sendMail({
        to,
        subject: 'Verify Your Email Address',
        template: 'verification',
        context: {
          username,
          token,
          baseUrl: this.baseUrl,
          expiresIn: this.verificationExpiresIn,
        },
      });

      this.logger.log(`Verification email sent successfully to: ${this.maskEmail(to)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to: ${this.maskEmail(to)}`,
        error instanceof Error ? error.stack : String(error)
      );
      throw error;
    }
  }

  /**
   * Send a password reset email to a user
   */
  async sendPasswordResetEmail(to: string, token: string, username: string): Promise<void> {
    this.logger.log(`Sending password reset email to: ${this.maskEmail(to)}`);

    try {
      await this.mailerService.sendMail({
        to,
        subject: 'Reset Your Password',
        template: 'reset-password',
        context: {
          username,
          token,
          baseUrl: this.baseUrl,
          expiresIn: this.resetExpiresIn,
        },
      });

      this.logger.log(`Password reset email sent successfully to: ${this.maskEmail(to)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email to: ${this.maskEmail(to)}`,
        error instanceof Error ? error.stack : String(error)
      );
      throw error;
    }
  }

  /**
   * Send a custom email with the provided options
   */
  async sendMail(options: MailOptions): Promise<void> {
    const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;
    this.logger.log(`Sending email to: ${this.maskEmail(recipients)}`);

    try {
      await this.mailerService.sendMail({
        to: options.to,
        subject: options.subject,
        template: options.template,
        context: options.context,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      });

      this.logger.log(`Email sent successfully to: ${this.maskEmail(recipients)}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to: ${this.maskEmail(recipients)}`,
        error instanceof Error ? error.stack : String(error)
      );
      throw error;
    }
  }

  /**
   * Mask an email address for logging purposes
   * Example: "john.doe@example.com" -> "j***@example.com"
   */
  private maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) {
      return '***';
    }

    const [localPart, domain] = parts;
    const maskedLocal =
      localPart.length > 1
        ? `${localPart[0]}${'*'.repeat(Math.min(localPart.length - 1, 3))}`
        : '*';

    return `${maskedLocal}@${domain}`;
  }
}
