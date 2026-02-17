import { IsEmail, IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';

export class SendMailDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Recipient email is required' })
  to: string;

  @IsString()
  @IsNotEmpty({ message: 'Subject is required' })
  subject: string;

  @IsString()
  @IsOptional()
  template?: string;

  @IsObject()
  @IsOptional()
  context?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  html?: string;

  @IsString()
  @IsOptional()
  text?: string;
}
