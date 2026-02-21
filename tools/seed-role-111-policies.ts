#!/usr/bin/env tsx
/**
 * Seed ABAC Policies for Role 111
 *
 * Creates ABAC policies that mirror the RBAC permissions for role "111".
 * Role 111 has the following permissions:
 * - audit:read
 * - permission:create
 *
 * Usage:
 *   pnpm run tools:seed-role-111-policies
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Detect if using Neon (requires SSL)
const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

// Create a minimal DataSource for this tool
const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/app',
  ssl: isNeon || process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

// Policy templates for role 111
const ROLE_111_POLICIES = [
  {
    name: 'Role: 111 - Read Audit Logs',
    description: 'ABAC policy for role 111 to read audit logs (mirrors RBAC permission audit:read)',
    effect: 'allow',
    subject: 'role:111',
    resource: 'audit',
    action: 'read',
    conditions: null,
    priority: 50,
    enabled: true,
  },
  {
    name: 'Role: 111 - Create Permissions',
    description:
      'ABAC policy for role 111 to create permissions (mirrors RBAC permission permission:create)',
    effect: 'allow',
    subject: 'role:111',
    resource: 'permission',
    action: 'create',
    conditions: null,
    priority: 50,
    enabled: true,
  },
];

/**
 * Check if a policy already exists
 */
async function policyExists(subject: string, resource: string, action: string): Promise<boolean> {
  const result = await dataSource.query(
    `SELECT id FROM policies WHERE subject = $1 AND resource = $2 AND action = $3`,
    [subject, resource, action]
  );
  return result.length > 0;
}

/**
 * Insert a policy
 */
async function insertPolicy(policy: (typeof ROLE_111_POLICIES)[0]): Promise<string> {
  const result = await dataSource.query(
    `INSERT INTO policies (name, description, effect, subject, resource, action, conditions, priority, enabled, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
     RETURNING id`,
    [
      policy.name,
      policy.description,
      policy.effect,
      policy.subject,
      policy.resource,
      policy.action,
      policy.conditions,
      policy.priority,
      policy.enabled,
    ]
  );
  return result[0].id;
}

/**
 * Main seed function
 */
async function seedRole111Policies(): Promise<void> {
  console.log('🌱 Seeding ABAC policies for role 111...\n');

  try {
    // Connect to database
    console.error('Connecting to database...');
    await dataSource.initialize();
    console.error('Database connected successfully\n');

    let created = 0;
    let skipped = 0;

    for (const policy of ROLE_111_POLICIES) {
      const exists = await policyExists(policy.subject, policy.resource, policy.action);

      if (exists) {
        console.log(`⏭️  Skipped (already exists): ${policy.name}`);
        skipped++;
      } else {
        const id = await insertPolicy(policy);
        console.log(`✅ Created: ${policy.name} (id: ${id})`);
        created++;
      }
    }

    console.log('\n📊 Summary:');
    console.log(`   Created: ${created}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total policies for role 111: ${created + skipped}`);

    if (created > 0) {
      console.log('\n✨ Role 111 ABAC policies seeded successfully!');
    } else {
      console.log('\n⚠️  All policies already exist. No new policies created.');
    }
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

// Run the seed
seedRole111Policies();
