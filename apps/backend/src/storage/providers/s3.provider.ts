import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StorageProvider, UploadOptions, UploadResult } from './interface';

/**
 * Configuration for S3-compatible storage providers.
 */
export interface S3Config {
  /** Access key ID */
  accessKeyId: string;
  /** Secret access key */
  secretAccessKey: string;
  /** Region name */
  region: string;
  /** Bucket name */
  bucket: string;
  /** Custom endpoint (for R2, OSS, COS, MinIO) */
  endpoint?: string;
  /** Use path-style URLs instead of virtual-hosted style */
  forcePathStyle?: boolean;
}

/**
 * S3-compatible storage provider.
 * Supports AWS S3, Cloudflare R2, Aliyun OSS, Tencent COS, and MinIO.
 */
export class S3Provider implements StorageProvider {
  private readonly client: S3Client;
  private readonly config: S3Config;

  constructor(config: S3Config) {
    this.config = config;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    });
  }

  /**
   * Upload a file to S3-compatible storage.
   * @param key - Object key/path
   * @param body - File content as Buffer, Uint8Array, or string
   * @param options - Optional upload settings like contentType and metadata
   * @returns Upload result with key, bucket, and url
   */
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

    await this.client.send(command);
    return {
      key,
      bucket: this.config.bucket,
      url: this.getUrl(key),
    };
  }

  /**
   * Delete a file from S3-compatible storage.
   * @param key - Object key/path
   */
  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Get public URL for an object.
   * Handles both virtual-hosted style and path-style URLs.
   * @param key - Object key/path
   * @returns Public URL
   */
  getUrl(key: string): string {
    if (this.config.endpoint) {
      const endpoint = this.config.endpoint.replace(/\/$/, '');

      // Path-style: endpoint/bucket/key
      if (this.config.forcePathStyle) {
        return `${endpoint}/${this.config.bucket}/${key}`;
      }

      // Virtual-hosted style: bucket.endpoint/key
      const url = new URL(this.config.endpoint);
      return `${url.protocol}//${this.config.bucket}.${url.host}/${key}`;
    }

    // Default AWS S3 URL format
    return `https://${this.config.bucket}.s3.${this.config.region}.amazonaws.com/${key}`;
  }
}
