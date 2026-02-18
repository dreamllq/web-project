/**
 * Options for uploading files to storage.
 */
export interface UploadOptions {
  /** MIME type of the file being uploaded */
  contentType?: string;
  /** Custom metadata key-value pairs to attach to the file */
  metadata?: Record<string, string>;
}

/**
 * Result returned after a successful file upload.
 */
export interface UploadResult {
  /** The key/path of the uploaded file */
  key: string;
  /** The bucket/container where the file was uploaded */
  bucket: string;
  /** The full URL to access the uploaded file */
  url: string;
}

/**
 * Unified interface for storage providers.
 * All storage implementations (S3, MinIO, Local) must conform to this interface.
 */
export interface StorageProvider {
  /**
   * Uploads a file to storage.
   * @param key - The unique key/path for the file
   * @param body - The file content as Buffer, Uint8Array, or string
   * @param options - Optional upload settings like contentType and metadata
   * @returns Promise resolving to upload result with key, bucket, and url
   */
  upload(
    key: string,
    body: Buffer | Uint8Array | string,
    options?: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Deletes a file from storage.
   * @param key - The key/path of the file to delete
   */
  delete(key: string): Promise<void>;

  /**
   * Gets the public URL for a file.
   * This is a synchronous operation that returns the URL immediately.
   * @param key - The key/path of the file
   * @returns The full URL to access the file
   */
  getUrl(key: string): string;
}
