export type StorageProvider = 's3' | 'oss' | 'minio';

export interface StorageConfig {
  provider: StorageProvider;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  bucket: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

export const storageConfig = (): StorageConfig => ({
  provider: (process.env.STORAGE_PROVIDER as StorageProvider) || 's3',
  accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
  region: process.env.STORAGE_REGION || 'us-east-1',
  bucket: process.env.STORAGE_BUCKET || '',
  endpoint: process.env.STORAGE_ENDPOINT,
  forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
});

export default storageConfig;
