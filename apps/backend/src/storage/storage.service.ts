import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { MultiStorageConfig } from '../config/storage.config';
import {
  createStorageProvider,
  MinIOProvider,
  S3Provider,
  StorageProvider,
  UploadOptions,
  UploadResult,
} from './providers';

export interface IStorageService {
  upload(
    key: string,
    body: Buffer | Uint8Array | string,
    options?: UploadOptions
  ): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getUrl(key: string): Promise<string>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
}

/**
 * Storage service that provides a unified interface for file storage operations.
 * Supports multiple storage backends (S3, MinIO, Local) through the provider factory.
 */
@Injectable()
export class StorageService implements IStorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider: StorageProvider;
  private readonly config: MultiStorageConfig;
  private readonly s3ClientForSignedUrl: S3Client | null = null;

  constructor(private readonly configService: ConfigService) {
     console.log('STORAGE CONFIG',this.configService.get<MultiStorageConfig>('storage') );
    this.config = this.configService.get<MultiStorageConfig>('storage') ?? {
      provider: 's3',
      s3: {
        endpoint: '',
        region: 'us-east-1',
        bucket: '',
        accessKeyId: '',
        secretAccessKey: '',
        forcePathStyle: false,
      },
      minio: {
        endpoint: '',
        accessKey: '',
        secretKey: '',
        bucket: '',
        useSSL: false,
      },
      local: {
        uploadDir: '',
        baseUrl: '',
      },
      accessKeyId: '',
      secretAccessKey: '',
      region: 'us-east-1',
      bucket: '',
    };

    // Create the appropriate provider based on configuration
    this.provider = createStorageProvider(this.config);

    // Create S3Client for signed URL generation (only for S3 provider)
    // MinIOProvider has its own getSignedUrl method
    if (this.config.provider === 's3') {
      this.s3ClientForSignedUrl = new S3Client({
        region: this.config.s3.region,
        credentials: {
          accessKeyId: this.config.s3.accessKeyId,
          secretAccessKey: this.config.s3.secretAccessKey,
        },
        endpoint: this.config.s3.endpoint || undefined,
        forcePathStyle: this.config.s3.forcePathStyle,
      });
    }

    this.logger.log(`StorageService initialized with provider: ${this.config.provider}`);
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array | string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const result = await this.provider.upload(key, body, options);
    this.logger.debug(`Uploaded file: ${key}`);
    return result;
  }

  async delete(key: string): Promise<void> {
    await this.provider.delete(key);
    this.logger.debug(`Deleted file: ${key}`);
  }

  async getUrl(key: string): Promise<string> {
    return this.provider.getUrl(key);
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    // MinIOProvider has its own getSignedUrl implementation
    if (this.provider instanceof MinIOProvider) {
      return this.provider.getSignedUrl(key, expiresIn);
    }

    // S3Provider uses the S3Client for signed URLs
    if (this.provider instanceof S3Provider && this.s3ClientForSignedUrl) {
      const command = new GetObjectCommand({
        Bucket: this.config.s3.bucket,
        Key: key,
      });
      return getSignedUrl(this.s3ClientForSignedUrl, command, { expiresIn });
    }

    // Local provider and others don't support signed URLs
    throw new Error(
      `Signed URLs are not supported for storage provider: ${this.config.provider}. ` +
        `Only S3 and MinIO providers support signed URLs.`
    );
  }
}
