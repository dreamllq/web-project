import { mkdir, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

import { StorageProvider, UploadOptions, UploadResult } from './interface';

export interface LocalConfig {
  uploadDir: string;
  baseUrl: string;
}

export class LocalProvider implements StorageProvider {
  private readonly config: LocalConfig;

  constructor(config: LocalConfig) {
    this.config = config;
    this.ensureUploadDirExists();
  }

  private async ensureUploadDirExists(): Promise<void> {
    try {
      await mkdir(this.config.uploadDir, { recursive: true });
    } catch (error) {
      // Directory already exists or will be created on demand
    }
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array | string,
    _options?: UploadOptions
  ): Promise<UploadResult> {
    const filePath = join(this.config.uploadDir, key);
    const dir = dirname(filePath);

    // Ensure subdirectories exist for nested keys
    await mkdir(dir, { recursive: true });

    await writeFile(filePath, body);

    return {
      key,
      bucket: this.config.uploadDir,
      url: this.getUrl(key),
    };
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.config.uploadDir, key);

    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist - silently ignore
    }
  }

  getUrl(key: string): string {
    return `${this.config.baseUrl}/${key}`;
  }
}
