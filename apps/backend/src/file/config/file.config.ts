import { registerAs } from '@nestjs/config';

export interface FileConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
}

export const fileConfig = registerAs(
  'file',
  (): FileConfig => ({
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
  })
);
