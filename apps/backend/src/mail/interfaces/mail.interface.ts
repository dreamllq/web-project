export interface MailOptions {
  to: string | string[];
  subject: string;
  template?: string;
  context?: Record<string, unknown>;
  html?: string;
  text?: string;
  attachments?: MailAttachment[];
}

export interface MailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

export interface VerificationEmailContext {
  username: string;
  verificationUrl: string;
  expiresIn: string;
}

export interface PasswordResetEmailContext {
  username: string;
  resetUrl: string;
  expiresIn: string;
}
