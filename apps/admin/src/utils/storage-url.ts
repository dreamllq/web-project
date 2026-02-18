/**
 * Storage URL Utility
 *
 * Handles the transformation of StorageUrlResponse to accessible URLs.
 * For local storage: returns the direct URL.
 * For S3/MinIO: fetches a signed URL (with caching).
 */

import type { StorageUrlResponse } from '@/types/user';
import api from '@/api/index';

// Cache for signed URLs: key -> { url, expiresAt }
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Get an accessible URL from a StorageUrlResponse
 *
 * @param avatar - The storage URL response from the API
 * @returns A Promise that resolves to the accessible URL, or null if not available
 */
export async function getAccessibleUrl(
  avatar: StorageUrlResponse | null | undefined
): Promise<string | null> {
  if (!avatar) {
    return null;
  }

  // Local storage: return direct URL
  if (avatar.type === 'local' && avatar.url) {
    return avatar.url;
  }

  // S3/MinIO: fetch signed URL
  if ((avatar.type === 's3' || avatar.type === 'minio') && avatar.key) {
    // Check cache
    const cached = signedUrlCache.get(avatar.key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.url;
    }

    // Fetch new signed URL
    try {
      const response = await api.get<{ url: string }>('/v1/storage/signed-url', {
        params: { key: avatar.key },
      });
      const url = response.data.url;

      // Cache for 6 days (signed URL valid for 7 days)
      signedUrlCache.set(avatar.key, {
        url,
        expiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
      });

      return url;
    } catch {
      console.error('Failed to fetch signed URL for key:', avatar.key);
      return null;
    }
  }

  return null;
}

/**
 * Clear the signed URL cache
 * Useful when logging out or when URLs might have changed
 */
export function clearSignedUrlCache(): void {
  signedUrlCache.clear();
}
