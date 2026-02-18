/**
 * Storage URL Response Types
 *
 * Unified response format for file URLs that supports multiple storage backends:
 * - local: Direct accessible URL (e.g., http://localhost:3000/uploads/...)
 * - s3/minio: Storage key, frontend fetches signed URL on demand
 */

export type StorageType = 'local' | 's3' | 'minio';

export interface StorageUrlResponse {
  /** Storage provider type */
  type: StorageType;
  /** Storage key for S3/MinIO (used to fetch signed URL) */
  key?: string;
  /** Direct accessible URL for local storage */
  url?: string;
}

/**
 * Response for signed URL endpoint
 */
export interface SignedUrlResponse {
  url: string;
}
