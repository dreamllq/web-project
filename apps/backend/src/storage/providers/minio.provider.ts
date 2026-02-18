import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageProvider, UploadOptions, UploadResult } from './interface';

export interface MinIOConfig {
  endpoint: string; // e.g., 'http://localhost:9000' or 'https://minio.example.com'
  accessKey: string;
  secretKey: string;
  bucket: string;
  useSSL?: boolean;
}

export class MinIOProvider implements StorageProvider {
  private readonly s3Client: S3Client;
  private readonly config: MinIOConfig;

  constructor(config: MinIOConfig) {
    this.config = config;

    // Parse endpoint to determine protocol
    const endpointUrl = new URL(config.endpoint);
    const useSSL = config.useSSL ?? endpointUrl.protocol === 'https:';

    this.s3Client = new S3Client({
      endpoint: config.endpoint,
      region: 'us-east-1', // MinIO ignores this but SDK requires it
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: true, // Required for MinIO
      tls: useSSL,
    });

    console.log(
      `[MinIOProvider] Initialized with endpoint: ${config.endpoint}, bucket: ${config.bucket}`
    );
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
    console.log(`[MinIOProvider] Uploaded file: ${key}`);

    return {
      key,
      bucket: this.config.bucket,
      url: this.getUrl(key),
    };
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
    console.log(`[MinIOProvider] Deleted file: ${key}`);
  }

  getUrl(key: string): string {
    // MinIO uses path-style URLs: {protocol}://{endpoint}/{bucket}/{key}
    const endpoint = this.config.endpoint.replace(/\/$/, '');
    return `${endpoint}/${this.config.bucket}/${key}`;
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }
}
