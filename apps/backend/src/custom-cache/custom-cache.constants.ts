/**
 * Cache key prefixes for different cache namespaces
 * These prefixes are used throughout the application
 */
export const CacheKeyPrefix = {
  /** Token blacklist prefix */
  BLACKLIST: 'blacklist',
  /** OAuth client prefix */
  OAUTH_CLIENT: 'oauth:client',
  /** OAuth authorization code prefix */
  OAUTH_CODE: 'oauth:code',
  /** OAuth token prefix */
  OAUTH_TOKEN: 'oauth:token',
} as const;

/**
 * TTL values in seconds
 */
export const CacheTTL = {
  /** Access token TTL: 15 minutes */
  ACCESS_TOKEN: 900,
  /** Refresh token TTL: 7 days */
  REFRESH_TOKEN: 604800,
  /** Authorization code TTL: 10 minutes */
  AUTHORIZATION_CODE: 600,
  /** OAuth access token TTL: 1 hour */
  OAUTH_ACCESS_TOKEN: 3600,
} as const;
