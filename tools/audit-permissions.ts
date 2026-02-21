#!/usr/bin/env tsx
/**
 * RBAC to ABAC Coverage Audit Tool
 *
 * Scans all RBAC permissions (Permission table) and ABAC policies (Policy table),
 * compares them, and outputs a coverage report identifying missing ABAC policies.
 *
 * Usage:
 *   pnpm run tools:audit-permissions           # Full coverage report
 *   pnpm run tools:audit-permissions -- --gaps # List only missing policies
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
interface RbacPermission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
}

interface AbacPolicy {
  id: string;
  name: string;
  effect: string;
  subject: string;
  resource: string;
  action: string;
  conditions: Record<string, unknown> | null;
  priority: number;
  enabled: boolean;
}

interface CoverageReport {
  rbac_count: number;
  abac_count: number;
  enabled_abac_count: number;
  coverage_percent: number;
  enabled_coverage_percent: number;
  missing_policies: Array<{ resource: string; action: string; permission_name: string }>;
  redundant_policies: Array<{ resource: string; action: string; reason: string }>;
  covered_permissions: Array<{ resource: string; action: string; permission_name: string }>;
  timestamp: string;
}

interface GapsReport {
  missing_policies: Array<{ resource: string; action: string; permission_name: string }>;
  rbac_count: number;
  missing_count: number;
  coverage_percent: number;
  timestamp: string;
}

/**
 * Check if an ABAC policy covers an RBAC permission
 */
function policyCoversPermission(policy: AbacPolicy, permission: RbacPermission): boolean {
  // Check resource match
  const resourceMatches =
    policy.resource === '*' ||
    policy.resource === permission.resource ||
    policy.resource.startsWith(`${permission.resource}:`) ||
    policy.resource === `${permission.resource}:*`;

  if (!resourceMatches) return false;

  // Check action match
  const actionMatches =
    policy.action === '*' ||
    policy.action === permission.action ||
    policy.action
      .split(',')
      .map((a) => a.trim())
      .includes(permission.action);

  return actionMatches;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { gapsOnly: boolean } {
  const args = process.argv.slice(2);
  return {
    gapsOnly: args.includes('--gaps'),
  };
}

/**
 * Main audit function
 */
async function auditPermissions(): Promise<void> {
  const { gapsOnly } = parseArgs();

  try {
    // Connect to database
    console.error('Connecting to database...');
    await dataSource.initialize();
    console.error('Database connected successfully');

    // Query all RBAC permissions
    const permissions = await dataSource.query<RbacPermission[]>(`
      SELECT id, name, resource, action, description
      FROM permissions
      ORDER BY resource, action
    `);

    // Query all ABAC policies
    const policies = await dataSource.query<AbacPolicy[]>(`
      SELECT id, name, effect, subject, resource, action, conditions, priority, enabled
      FROM policies
      ORDER BY priority DESC, resource, action
    `);

    const enabledPolicies = policies.filter((p) => p.enabled);

    // Find missing and covered permissions
    const missingPolicies: CoverageReport['missing_policies'] = [];
    const coveredPermissions: CoverageReport['covered_permissions'] = [];

    for (const permission of permissions) {
      // Check against enabled policies only for coverage
      const isCovered = enabledPolicies.some((policy) =>
        policyCoversPermission(policy, permission)
      );

      if (isCovered) {
        coveredPermissions.push({
          resource: permission.resource,
          action: permission.action,
          permission_name: permission.name,
        });
      } else {
        missingPolicies.push({
          resource: permission.resource,
          action: permission.action,
          permission_name: permission.name,
        });
      }
    }

    // Find redundant policies (policies that don't cover any permission)
    const redundantPolicies: CoverageReport['redundant_policies'] = [];
    for (const policy of policies) {
      // Skip wildcard policies as they're intentionally broad
      if (policy.resource === '*' && policy.action === '*') continue;

      const coversAny = permissions.some((permission) =>
        policyCoversPermission(policy, permission)
      );

      if (!coversAny) {
        redundantPolicies.push({
          resource: policy.resource,
          action: policy.action,
          reason: 'No matching RBAC permission found',
        });
      }
    }

    // Calculate coverage
    const rbacCount = permissions.length;
    const abacCount = policies.length;
    const enabledAbacCount = enabledPolicies.length;
    const coveragePercent =
      rbacCount > 0 ? Math.round((coveredPermissions.length / rbacCount) * 100 * 10) / 10 : 0;

    // If gaps-only mode, output simplified report
    if (gapsOnly) {
      const gapsReport: GapsReport = {
        missing_policies: missingPolicies,
        rbac_count: rbacCount,
        missing_count: missingPolicies.length,
        coverage_percent: coveragePercent,
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(gapsReport, null, 2));
    } else {
      // Full coverage report
      const report: CoverageReport = {
        rbac_count: rbacCount,
        abac_count: abacCount,
        enabled_abac_count: enabledAbacCount,
        coverage_percent: coveragePercent,
        enabled_coverage_percent: coveragePercent,
        missing_policies: missingPolicies,
        redundant_policies: redundantPolicies,
        covered_permissions: coveredPermissions,
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(report, null, 2));
    }
  } catch (error) {
    console.error('Error during audit:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

// Run the audit
auditPermissions();
