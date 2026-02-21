#!/usr/bin/env tsx
/**
 * ABAC Policy Seed Script for Role-Based Policies
 *
 * Creates ABAC policies for specific roles based on their RBAC permissions.
 * This script is used during the RBAC→ABAC migration to create equivalent
 * ABAC policies for each role's permissions.
 *
 * Usage:
 *   pnpm run tools:seed-role-policies -- --role 啊啊啊
 *   pnpm run tools:seed-role-policies -- --role 啊啊啊 --dry-run
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

// Types
interface RolePermission {
  role_id: string;
  role_name: string;
  permission_id: string;
  permission_name: string;
  resource: string;
  action: string;
}

interface PolicyInput {
  name: string;
  description: string;
  effect: string;
  subject: string;
  resource: string;
  action: string;
  conditions: null;
  priority: number;
  enabled: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { roleName: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  const roleIndex = args.indexOf('--role');

  if (roleIndex === -1 || roleIndex + 1 >= args.length) {
    console.error('Usage: tsx tools/seed-role-policies.ts --role <roleName> [--dry-run]');
    process.exit(1);
  }

  return {
    roleName: args[roleIndex + 1],
    dryRun: args.includes('--dry-run'),
  };
}

/**
 * Main seed function
 */
async function seedRolePolicies(): Promise<void> {
  const { roleName, dryRun } = parseArgs();

  console.error(`\n=== ABAC Policy Seed for Role: "${roleName}" ===\n`);
  console.error(
    `Mode: ${dryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (will insert policies)'}\n`
  );

  try {
    // Connect to database
    console.error('Connecting to database...');
    await dataSource.initialize();
    console.error('Database connected successfully\n');

    // Query the role's permissions
    const rolePermissions = await dataSource.query<RolePermission[]>(
      `
      SELECT 
        r.id as role_id,
        r.name as role_name,
        p.id as permission_id,
        p.name as permission_name,
        p.resource,
        p.action
      FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE r.name = $1
      ORDER BY p.resource, p.action
    `,
      [roleName]
    );

    if (rolePermissions.length === 0) {
      console.error(`No permissions found for role "${roleName}"`);
      console.error('This could mean:');
      console.error('  1. The role does not exist');
      console.error('  2. The role has no permissions assigned');
      process.exit(1);
    }

    console.error(`Found ${rolePermissions.length} permissions for role "${roleName}":`);
    for (const perm of rolePermissions) {
      console.error(`  - ${perm.permission_name} (${perm.resource}:${perm.action})`);
    }
    console.error('');

    // Check for existing policies
    const existingPolicies = await dataSource.query(
      `
      SELECT name, subject, resource, action
      FROM policies
      WHERE subject = $1
    `,
      [`role:${roleName}`]
    );

    if (existingPolicies.length > 0) {
      console.error(`Found ${existingPolicies.length} existing policies for this role:`);
      for (const policy of existingPolicies) {
        console.error(`  - ${policy.name} (${policy.resource}:${policy.action})`);
      }
      console.error('');
    }

    // Build policy records
    const policies: PolicyInput[] = rolePermissions.map((perm) => ({
      name: `Role: ${roleName} - ${perm.resource}:${perm.action}`,
      description: `ABAC policy for role "${roleName}" covering ${perm.permission_name}`,
      effect: 'allow',
      subject: `role:${roleName}`,
      resource: perm.resource,
      action: perm.action,
      conditions: null,
      priority: 50,
      enabled: true,
    }));

    console.error('Policies to create:');
    for (const policy of policies) {
      console.error(`  - ${policy.name}`);
      console.error(`    Subject: ${policy.subject}`);
      console.error(`    Resource: ${policy.resource}, Action: ${policy.action}`);
      console.error(`    Priority: ${policy.priority}, Enabled: ${policy.enabled}`);
    }
    console.error('');

    if (dryRun) {
      console.error('DRY RUN - No changes made to database');
      console.error('\nTo apply these changes, run without --dry-run flag');
    } else {
      // Insert policies
      console.error('Inserting policies...');

      for (const policy of policies) {
        // Check if policy already exists
        const existing = await dataSource.query(
          `
          SELECT id FROM policies 
          WHERE subject = $1 AND resource = $2 AND action = $3
        `,
          [policy.subject, policy.resource, policy.action]
        );

        if (existing.length > 0) {
          console.error(`  SKIPPING (already exists): ${policy.name}`);
          continue;
        }

        await dataSource.query(
          `
          INSERT INTO policies (name, description, effect, subject, resource, action, conditions, priority, enabled, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        `,
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
        console.error(`  INSERTED: ${policy.name}`);
      }

      console.error('\n✅ Policies created successfully!');
    }

    console.error('\n=== Summary ===');
    console.error(`Role: ${roleName}`);
    console.error(`Permissions: ${rolePermissions.length}`);
    console.error(`Policies: ${policies.length}`);
    console.error(`Subject pattern: role:${roleName}`);
    console.error('');
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
seedRolePolicies();
