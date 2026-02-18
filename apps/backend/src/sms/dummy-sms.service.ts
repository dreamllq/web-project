import { Injectable, Logger } from '@nestjs/common';
import { SmsServiceInterface, SendSmsResult } from './sms.service.interface';

/**
 * Dummy SMS Service
 *
 * This is a placeholder implementation for development/testing.
 * It logs SMS messages instead of actually sending them.
 *
 * To use a real SMS provider:
 * 1. Create a new service implementing SmsServiceInterface
 * 2. Update SmsModule to use the new service
 *
 * Supported providers (to be implemented):
 * - Aliyun SMS
 * - Tencent Cloud SMS
 * - Twilio
 * - Firebase Phone Auth
 */
@Injectable()
export class DummySmsService implements SmsServiceInterface {
  private readonly logger = new Logger(DummySmsService.name);

  async sendVerificationCode(phone: string, code: string): Promise<SendSmsResult> {
    // In development, just log the code
    this.logger.log(
      `[DUMMY SMS] Verification code for ${phone}: ${code}\n` +
        `To integrate real SMS, implement SmsServiceInterface with your provider.`
    );

    // Simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `dummy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  async verifyCode(phone: string, code: string): Promise<boolean> {
    this.logger.log(`[DUMMY SMS] Verifying code for ${phone}: ${code}`);
    // In dummy mode, always return true
    return true;
  }

  async sendSms(phone: string, message: string): Promise<SendSmsResult> {
    this.logger.log(`[DUMMY SMS] Sending to ${phone}: ${message}`);

    await new Promise((resolve) => setTimeout(resolve, 100));

    return {
      success: true,
      messageId: `dummy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }
}
