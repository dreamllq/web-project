/**
 * Multi-Provider Storage Configuration
 *
 * Supports three storage providers:
 * - s3: AWS S3, Cloudflare R2, Aliyun OSS, Tencent COS
 * - minio: MinIO server
 * - local: Local filesystem storage
 *
 * Environment Variables:
 * - STORAGE_PROVIDER: 's3' | 'minio' | 'local' (default: 'local')
 *
 * S3 Configuration (for AWS, R2, OSS, COS):
 * - S3_ENDPOINT: e.g., 'https://s3.amazonaws.com'
 * - S3_REGION: e.g., 'us-east-1'
 * - S3_BUCKET: bucket name
 * - S3_ACCESS_KEY_ID: access key
 * - S3_SECRET_ACCESS_KEY: secret key
 * - S3_FORCE_PATH_STYLE: 'true' | 'false'
 *
 * MinIO Configuration:
 * - MINIO_ENDPOINT: e.g., 'http://localhost:9000'
 * - MINIO_ACCESS_KEY: access key
 * - MINIO_SECRET_KEY: secret key
 * - MINIO_BUCKET: bucket name
 * - MINIO_USE_SSL: 'true' | 'false'
 *
 * Local Configuration:
 * - LOCAL_UPLOAD_DIR: e.g., './uploads'
 * - LOCAL_BASE_URL: e.g., 'http://localhost:3000/uploads'
 *
 * Backward Compatibility:
 * Legacy STORAGE_* environment variables are still supported and map to S3_* vars:
 * - STORAGE_ACCESS_KEY_ID -> S3_ACCESS_KEY_ID
 * - STORAGE_SECRET_ACCESS_KEY -> S3_SECRET_ACCESS_KEY
 * - STORAGE_REGION -> S3_REGION
 * - STORAGE_BUCKET -> S3_BUCKET
 * - STORAGE_ENDPOINT -> S3_ENDPOINT
 * - STORAGE_FORCE_PATH_STYLE -> S3_FORCE_PATH_STYLE
 */

import { registerAs } from '@nestjs/config';

export type StorageProvider = 's3' | 'minio' | 'local';

/**
 * S3-compatible configuration (for AWS S3, Cloudflare R2, Aliyun OSS, Tencent COS)
 */
export interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/**
 * MinIO-specific configuration
 */
export interface MinIOConfig {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  useSSL: boolean;
}

/**
 * Local filesystem configuration
 */
export interface LocalConfig {
  uploadDir: string;
  baseUrl: string;
}

/**
 * Legacy storage config for backward compatibility with StorageService
 */
export interface StorageConfig {
  provider: StorageProvider;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

/**
 * Multi-provider storage configuration
 * Contains configurations for all providers plus the active provider selection
 */
export interface MultiStorageConfig extends StorageConfig {
  provider: StorageProvider;

  /** S3-compatible provider configuration */
  s3: S3Config;

  /** MinIO provider configuration */
  minio: MinIOConfig;

  /** Local filesystem provider configuration */
  local: LocalConfig;

  /** Legacy flat config fields for backward compatibility */
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

/**
 * Validation error with helpful message
 */
class StorageConfigError extends Error {
  constructor(message: string) {
    super(`Storage Configuration Error: ${message}`);
    this.name = 'StorageConfigError';
  }
}

/**
 * Get environment variable with fallback to legacy naming
 */
function getEnvWithFallback(primary: string, fallback: string): string | undefined {
  return process.env[primary] ?? process.env[fallback];
}

/**
 * Parse boolean environment variable
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value === 'true';
}

/**
 * Validate S3 configuration
 */
function validateS3Config(config: S3Config): void {
  const missing: string[] = [];

  if (!config.accessKeyId) missing.push('S3_ACCESS_KEY_ID (or STORAGE_ACCESS_KEY_ID)');
  if (!config.secretAccessKey) missing.push('S3_SECRET_ACCESS_KEY (or STORAGE_SECRET_ACCESS_KEY)');
  if (!config.bucket) missing.push('S3_BUCKET (or STORAGE_BUCKET)');

  if (missing.length > 0) {
    throw new StorageConfigError(
      `Missing required S3 configuration: ${missing.join(', ')}. ` +
        `Please set these environment variables or use a different storage provider.`
    );
  }
}

/**
 * Validate MinIO configuration
 */
function validateMinIOConfig(config: MinIOConfig): void {
  const missing: string[] = [];

  if (!config.endpoint) missing.push('MINIO_ENDPOINT');
  if (!config.accessKey) missing.push('MINIO_ACCESS_KEY');
  if (!config.secretKey) missing.push('MINIO_SECRET_KEY');
  if (!config.bucket) missing.push('MINIO_BUCKET');

  if (missing.length > 0) {
    throw new StorageConfigError(
      `Missing required MinIO configuration: ${missing.join(', ')}. ` +
        `Please set these environment variables or use a different storage provider.`
    );
  }
}

/**
 * Validate Local configuration
 */
function validateLocalConfig(_config: LocalConfig): void {
  // With defaults for uploadDir and baseUrl, local config is always valid
  // No validation needed since we provide sensible defaults for development
}

/**
 * Build S3 configuration from environment variables
 */
function buildS3Config(): S3Config {
  return {
    endpoint: getEnvWithFallback('S3_ENDPOINT', 'STORAGE_ENDPOINT') ?? '',
    region: getEnvWithFallback('S3_REGION', 'STORAGE_REGION') ?? 'us-east-1',
    bucket: getEnvWithFallback('S3_BUCKET', 'STORAGE_BUCKET') ?? '',
    accessKeyId: getEnvWithFallback('S3_ACCESS_KEY_ID', 'STORAGE_ACCESS_KEY_ID') ?? '',
    secretAccessKey: getEnvWithFallback('S3_SECRET_ACCESS_KEY', 'STORAGE_SECRET_ACCESS_KEY') ?? '',
    forcePathStyle: parseBoolean(
      getEnvWithFallback('S3_FORCE_PATH_STYLE', 'STORAGE_FORCE_PATH_STYLE'),
      false
    ),
  };
}

/**
 * Build MinIO configuration from environment variables
 */
function buildMinIOConfig(): MinIOConfig {
  const endpoint = process.env.MINIO_ENDPOINT ?? '';
  return {
    endpoint,
    accessKey: process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: process.env.MINIO_SECRET_KEY ?? '',
    bucket: process.env.MINIO_BUCKET ?? '',
    useSSL: parseBoolean(process.env.MINIO_USE_SSL, endpoint.startsWith('https')),
  };
}

/**
 * Build Local configuration from environment variables
 */
function buildLocalConfig(): LocalConfig {
  return {
    uploadDir: process.env.LOCAL_UPLOAD_DIR ?? './uploads',
    baseUrl: process.env.LOCAL_BASE_URL ?? 'http://localhost:3000/uploads',
  };
}

/**
 * Get the active provider configuration as flat legacy format
 */
function getActiveProviderLegacyConfig(
  provider: StorageProvider,
  s3: S3Config,
  minio: MinIOConfig
): Pick<
  StorageConfig,
  'accessKeyId' | 'secretAccessKey' | 'region' | 'bucket' | 'endpoint' | 'forcePathStyle'
> {
  switch (provider) {
    case 's3':
      return {
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey,
        region: s3.region,
        bucket: s3.bucket,
        endpoint: s3.endpoint || undefined,
        forcePathStyle: s3.forcePathStyle,
      };
    case 'minio':
      return {
        accessKeyId: minio.accessKey,
        secretAccessKey: minio.secretKey,
        region: 'local',
        bucket: minio.bucket,
        endpoint: minio.endpoint,
        forcePathStyle: true, // MinIO typically uses path-style
      };
    case 'local':
      return {
        accessKeyId: '',
        secretAccessKey: '',
        region: 'local',
        bucket: 'local',
        endpoint: undefined,
        forcePathStyle: false,
      };
    default:
      throw new StorageConfigError(`Unknown storage provider: ${provider}`);
  }
}

/**
 * Multi-provider storage configuration factory
 * Returns configuration with all provider configs plus backward-compatible flat fields
 */

export const storageConfig = registerAs('storage', () => {
  const provider = (process.env.STORAGE_PROVIDER as StorageProvider) || 'local';

  // Validate provider value
  const validProviders: StorageProvider[] = ['s3', 'minio', 'local'];
  if (!validProviders.includes(provider)) {
    throw new StorageConfigError(
      `Invalid STORAGE_PROVIDER: '${provider}'. Must be one of: ${validProviders.join(', ')}`
    );
  }

  // Build provider-specific configs
  const s3 = buildS3Config();
  const minio = buildMinIOConfig();
  const local = buildLocalConfig();

  // Validate the active provider's configuration
  switch (provider) {
    case 's3':
      validateS3Config(s3);
      break;
    case 'minio':
      validateMinIOConfig(minio);
      break;
    case 'local':
      validateLocalConfig(local);
      break;
  }

  // Get legacy flat config for backward compatibility
  const legacyConfig = getActiveProviderLegacyConfig(provider, s3, minio);

  return {
    provider,
    s3,
    minio,
    local,
    ...legacyConfig,
  };
});

export default storageConfig;
