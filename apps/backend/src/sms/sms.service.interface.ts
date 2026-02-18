export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface VerificationCodeResult {
  success: boolean;
  expiresAt?: Date;
  error?: string;
}

export interface SmsServiceInterface {
  /**
   * Send verification code to phone number
   * @param phone Phone number in E.164 format (e.g., +8613800138000)
   * @param code The verification code to send
   */
  sendVerificationCode(phone: string, code: string): Promise<SendSmsResult>;

  /**
   * Verify a code against a phone number
   * This is for server-side verification (some providers like Firebase)
   * @param phone Phone number
   * @param code The code to verify
   */
  verifyCode?(phone: string, code: string): Promise<boolean>;

  /**
   * Send a generic SMS message
   * @param phone Phone number
   * @param message Message content
   */
  sendSms?(phone: string, message: string): Promise<SendSmsResult>;
}
