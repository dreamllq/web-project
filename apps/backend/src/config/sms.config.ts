import { registerAs } from '@nestjs/config';

export interface SmsConfig {
  /**
   * SMS provider to use
   * - 'dummy': Log only (development)
   * - 'aliyun': Aliyun SMS
   * - 'tencent': Tencent Cloud SMS
   * - 'twilio': Twilio
   */
  provider: 'dummy' | 'aliyun' | 'tencent' | 'twilio';

  /**
   * Verification code length
   */
  codeLength: number;

  /**
   * Verification code expiry in seconds
   */
  codeExpiry: number;

  /**
   * Rate limiting: max codes per phone per hour
   */
  maxCodesPerHour: number;

  /**
   * Provider-specific configuration
   */
  aliyun?: {
    accessKeyId: string;
    accessKeySecret: string;
    signName: string;
    templateCode: string;
  };

  tencent?: {
    secretId: string;
    secretKey: string;
    appId: string;
    signName: string;
    templateId: string;
  };

  twilio?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
  };
}

export const smsConfig = registerAs('sms', () => ({
  provider: (process.env.SMS_PROVIDER as SmsConfig['provider']) || 'dummy',
  codeLength: parseInt(process.env.SMS_CODE_LENGTH || '6', 10),
  codeExpiry: parseInt(process.env.SMS_CODE_EXPIRY || '300', 10), // 5 minutes
  maxCodesPerHour: parseInt(process.env.SMS_MAX_CODES_PER_HOUR || '5', 10),
}));

export default smsConfig;
