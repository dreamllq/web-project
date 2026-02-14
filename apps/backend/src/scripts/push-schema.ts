/**
 * Script to push database schema directly
 * This is useful for development when migrations don't work
 *
 * Usage: pnpm db:push
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

import { DataSource, DataSourceOptions } from 'typeorm';
import { User } from '../entities/user.entity';
import { SocialAccount } from '../entities/social-account.entity';
import { Attribute } from '../entities/attribute.entity';
import { Policy } from '../entities/policy.entity';
import { PolicyAttribute } from '../entities/policy-attribute.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { Notification } from '../entities/notification.entity';
import { File } from '../entities/file.entity';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthToken } from '../entities/oauth-token.entity';

// Detect if using Neon (requires SSL)
const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [
    User,
    SocialAccount,
    Attribute,
    Policy,
    PolicyAttribute,
    AuditLog,
    Notification,
    File,
    OAuthClient,
    OAuthToken,
  ],
  synchronize: true, // This will create/update tables automatically
  logging: true,
  ssl: isNeon || process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

async function pushSchema() {
  console.log('🔄 Connecting to database...');
  console.log(`📍 Database URL: ${process.env.DATABASE_URL?.substring(0, 50)}...`);

  const dataSource = new DataSource(dataSourceOptions);

  try {
    await dataSource.initialize();
    console.log('✅ Connected to database');

    console.log('🔄 Synchronizing schema...');
    await dataSource.synchronize(true); // true = drop and recreate tables
    console.log('✅ Schema synchronized successfully!');

    await dataSource.destroy();
    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

pushSchema();
