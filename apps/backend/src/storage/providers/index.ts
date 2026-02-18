/**
 * Storage Provider Factory and Exports
 *
 * This module exports all storage providers and provides a factory function
 * to create the appropriate provider based on configuration.
 */

// Import types from storage.config
import type { MultiStorageConfig } from '../../config/storage.config';

// Import interfaces from interface.ts
import type { StorageProvider, UploadOptions, UploadResult } from './interface';

// Import providers
import { S3Provider } from './s3.provider';
import type { S3Config } from './s3.provider';

import { MinIOProvider } from './minio.provider';
import type { MinIOConfig } from './minio.provider';

import { LocalProvider } from './local.provider';
import type { LocalConfig } from './local.provider';

// Re-export all types and classes
export { StorageProvider, UploadOptions, UploadResult };
export { S3Provider, MinIOProvider, LocalProvider };
export type { S3Config, MinIOConfig, LocalConfig };

/**
 * Factory function to create a storage provider based on configuration.
 * @param config - Multi-storage configuration containing provider selection and configs
 * @returns The appropriate storage provider instance
 * @throws Error if the provider type is not supported
 */
export function createStorageProvider(config: MultiStorageConfig) {
  switch (config.provider) {
    case 's3':
      return new S3Provider({
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
        region: config.s3.region,
        bucket: config.s3.bucket,
        endpoint: config.s3.endpoint || undefined,
        forcePathStyle: config.s3.forcePathStyle,
      });

    case 'minio':
      return new MinIOProvider({
        endpoint: config.minio.endpoint,
        accessKey: config.minio.accessKey,
        secretKey: config.minio.secretKey,
        bucket: config.minio.bucket,
        useSSL: config.minio.useSSL,
      });

    case 'local':
      return new LocalProvider({
        uploadDir: config.local.uploadDir,
        baseUrl: config.local.baseUrl,
      });

    default:
      throw new Error(`Unsupported storage provider: ${(config as { provider: string }).provider}`);
  }
}

/**
 * Type guard to check if a provider supports signed URLs.
 * S3 and MinIO providers support signed URLs, Local provider does not.
 */
export function supportsSignedUrl(
  provider: ReturnType<typeof createStorageProvider>
): provider is MinIOProvider {
  return provider instanceof MinIOProvider;
}
