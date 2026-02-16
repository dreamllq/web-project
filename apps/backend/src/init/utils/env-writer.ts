import * as fs from 'fs';
import * as path from 'path';

/**
 * Configuration for initializing the application environment
 */
export interface InitConfig {
  database: {
    type: 'local' | 'remote';
    // For local:
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    database?: string;
    // For remote:
    url?: string;
  };
  redis: {
    url: string;
  };
}

/**
 * URL encodes a password for use in connection strings
 */
function encodePassword(password: string): string {
  return encodeURIComponent(password);
}

/**
 * Builds the DATABASE_URL from local database configuration
 */
function buildDatabaseUrl(config: InitConfig['database']): string {
  if (config.type === 'remote' && config.url) {
    return config.url;
  }

  const host = config.host || 'localhost';
  const port = config.port || 5432;
  const username = config.username || 'postgres';
  const password = config.password ? encodePassword(config.password) : '';
  const database = config.database || 'app';

  return `postgresql://${username}:${password}@${host}:${port}/${database}`;
}

/**
 * Generates the .env.local file content from the configuration
 */
function generateEnvContent(config: InitConfig): string {
  const lines: string[] = [];

  // Database Configuration
  lines.push('# Database Configuration');
  lines.push(`DATABASE_URL=${buildDatabaseUrl(config.database)}`);
  lines.push('');

  // Redis Configuration
  lines.push('# Redis Configuration');
  lines.push(`REDIS_URL=${config.redis.url}`);
  lines.push('');

  // Initialization Status
  lines.push('# Initialization Status');
  lines.push('APP_INITIALIZED=true');

  return lines.join('\n');
}

/**
 * Writes the .env.local file with the given configuration
 *
 * @param config - The initialization configuration
 * @param customPath - Optional custom path for the .env.local file (used for testing)
 */
export function writeEnvFile(config: InitConfig, customPath?: string): void {
  // Default path: 4 levels up from this file (project root)
  // From: apps/backend/src/init/utils/ -> project root
  const envPath = customPath || path.join(__dirname, '../../../../../.env.local');

  const content = generateEnvContent(config);

  // Write with permissions: 0o600 (owner read/write only)
  // Note: On Windows, file permissions work differently, but we set it anyway
  fs.writeFileSync(envPath, content, {
    encoding: 'utf-8',
    mode: 0o600,
  });
}
