import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig } from '../config/storage.config';

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  bucket: string;
  url: string;
}

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

@Injectable()
export class StorageService implements IStorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly config: StorageConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<StorageConfig>('storage') ?? {
      provider: 's3',
      accessKeyId: '',
      secretAccessKey: '',
      region: 'us-east-1',
      bucket: '',
    };

    this.s3Client = new S3Client({
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
      endpoint: this.config.endpoint,
      forcePathStyle: this.config.forcePathStyle,
    });

    this.logger.log(`StorageService initialized with provider: ${this.config.provider}`);
  }

  async upload(
    key: string,
    body: Buffer | Uint8Array | string,
    options?: UploadOptions
  ): Promise<UploadResult> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: body,
      ContentType: options?.contentType,
      Metadata: options?.metadata,
    });

    await this.s3Client.send(command);
    this.logger.debug(`Uploaded file: ${key}`);

    return {
      key,
      bucket: this.config.bucket,
      url: await this.getUrl(key),
    };
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
    this.logger.debug(`Deleted file: ${key}`);
  }

  async getUrl(key: string): Promise<string> {
    if (this.config.endpoint) {
      const endpoint = this.config.endpoint.replace(/\/$/, '');
      if (this.config.forcePathStyle) {
        return `${endpoint}/${this.config.bucket}/${key}`;
      }
      const url = new URL(this.config.endpoint);
      return `${url.protocol}//${this.config.bucket}.${url.host}/${key}`;
    }

    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
