import { registerAs } from '@nestjs/config';
import * as path from 'path';

export interface StorageConfig {
  uploadDir: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
}

export const storageConfig = registerAs(
  'storage',
  (): StorageConfig => ({
    uploadDir: process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'),
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ],
  }),
);
