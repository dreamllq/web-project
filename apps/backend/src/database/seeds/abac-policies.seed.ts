#!/usr/bin/env tsx
/**
 * ABAC Policies Seed Script
 *
 * Creates ABAC policies for RBAC role migration.
 * Uses Option A (single wildcard policy) for super_admin role.
 *
 * Usage:
 *   npx tsx apps/backend/src/database/seeds/abac-policies.seed.ts
 *   npx tsx apps/backend/src/database/seeds/abac-policies.seed.ts --dry-run
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// CommonJS compatible __dirname (tsx provides this)
// No need for fileURLToPath in tsx environment

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

// Detect if using Neon (requires SSL)
const isNeon = process.env.DATABASE_URL?.includes('neon.tech');

// Create DataSource
const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/app',
  ssl: isNeon || process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

/**
 * Parse command line arguments
 */
function parseArgs(): { dryRun: boolean; force: boolean } {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
  };
}

/**
 * ABAC policies for super_admin role
 * Using Option A: Single wildcard policy (recommended)
 */
const SUPER_ADMIN_POLICIES = [
  {
    name: 'Super Admin - Full Access',
    description: 'Grants full access to all resources and actions for super_admin role',
    effect: 'allow',
    subject: 'role:super_admin',
    resource: '*',
    action: '*',
    conditions: null,
    priority: 900, // High priority but below 1000 (reserved for individual super admin user policies)
    enabled: true,
  },
];

/**
 * Wildcard policies for default access control
 * These provide sensible defaults that can be overridden by role-based policies
 */
const WILDCARD_POLICIES = [
  {
    name: 'Default Allow - User Profile Read',
    description: 'Allows all authenticated users to read user profile (low priority fallback)',
    effect: 'allow',
    subject: '*',
    resource: 'user:profile',
    action: 'read',
    conditions: null,
    priority: 10, // Low priority - only applies if no higher priority policy matches
    enabled: true,
  },
  {
    name: 'Default Deny - Delete Action',
    description:
      'Denies delete action for all users by default (allows role-based policies to override)',
    effect: 'deny',
    subject: '*',
    resource: '*',
    action: 'delete',
    conditions: null,
    priority: 5, // Very low priority - role-based policies with higher priority can override
    enabled: true,
  },
];

/**
 * All policies to seed (combine super_admin + wildcard)
 */
const ALL_POLICIES = [...SUPER_ADMIN_POLICIES, ...WILDCARD_POLICIES];

async function seedPolicies(): Promise<void> {
  const { dryRun, force } = parseArgs();

  try {
    console.error('Connecting to database...');
    await dataSource.initialize();
    console.error('Database connected successfully');

    for (const policy of ALL_POLICIES) {
      // Check if policy already exists
      const existing = await dataSource.query(`SELECT id, name FROM policies WHERE name = $1`, [
        policy.name,
      ]);

      if (existing.length > 0) {
        if (force) {
          console.error(`Updating existing policy: ${policy.name}`);
          if (!dryRun) {
            await dataSource.query(
              `UPDATE policies SET 
                effect = $1, 
                subject = $2, 
                resource = $3, 
                action = $4, 
                conditions = $5, 
                priority = $6, 
                enabled = $7,
                updated_at = NOW()
              WHERE name = $8`,
              [
                policy.effect,
                policy.subject,
                policy.resource,
                policy.action,
                policy.conditions,
                policy.priority,
                policy.enabled,
                policy.name,
              ]
            );
            console.error(`  Updated: ${policy.name}`);
          } else {
            console.error(`  [DRY RUN] Would update: ${policy.name}`);
          }
        } else {
          console.error(`Policy already exists: ${policy.name} (use --force to update)`);
        }
        continue;
      }

      console.error(`Creating policy: ${policy.name}`);

      if (!dryRun) {
        await dataSource.query(
          `INSERT INTO policies (name, description, effect, subject, resource, action, conditions, priority, enabled, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
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
        console.error(`  Created: ${policy.name}`);
      } else {
        console.error(`  [DRY RUN] Would create: ${policy.name}`);
      }
    }

    console.error('\nSeed completed successfully!');

    // Show summary
    const superAdminCount = await dataSource.query(
      `SELECT COUNT(*) FROM policies WHERE subject = 'role:super_admin'`
    );
    const wildcardCount = await dataSource.query(
      `SELECT COUNT(*) FROM policies WHERE subject = '*'`
    );
    console.error(`Total super_admin policies: ${superAdminCount[0].count}`);
    console.error(`Total wildcard policies: ${wildcardCount[0].count}`);
  } catch (error) {
    console.error('Error during seed:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

// Run the seed
seedPolicies();
