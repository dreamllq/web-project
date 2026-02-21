#!/usr/bin/env tsx
/**
 * RBAC to ABAC Migration Verification Tool
 *
 * Compares permission evaluation results between RBAC and ABAC systems.
 * Reports any discrepancies to help verify migration correctness.
 *
 * Usage:
 *   pnpm run tools:verify-migration              # Full verification
 *   pnpm run tools:verify-migration -- --user ID # Verify specific user
 *   pnpm run tools:verify-migration -- --verbose # Show all checks
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
interface User {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  status: string;
}

interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

interface Policy {
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

interface Mismatch {
  user_id: string;
  username: string;
  permission: string;
  resource: string;
  action: string;
  rbac_result: boolean;
  abac_result: boolean;
}

interface VerificationReport {
  total_users: number;
  total_permissions_checked: number;
  matching: number;
  mismatching: number;
  mismatches: Mismatch[];
  timestamp: string;
}

interface CommandLineArgs {
  userId?: string;
  verbose: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): CommandLineArgs {
  const args = process.argv.slice(2);
  const result: CommandLineArgs = { verbose: false };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--user' && args[i + 1]) {
      result.userId = args[i + 1];
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      result.verbose = true;
    }
  }

  return result;
}

/**
 * Get all permissions for a user via RBAC (direct database query)
 */
async function getRbacPermissions(userId: string): Promise<string[]> {
  const query = `
    SELECT DISTINCT p.name
    FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    INNER JOIN user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = $1
  `;

  const result = await dataSource.query<{ name: string }[]>(query, [userId]);
  return result.map((r) => r.name);
}

/**
 * Check if user has a specific RBAC permission
 */
function hasRbacPermission(
  _permissionName: string,
  resource: string,
  action: string,
  userPermissions: string[]
): boolean {
  // Check for exact permission: "resource:action"
  const exactPermission = `${resource}:${action}`;
  if (userPermissions.includes(exactPermission)) {
    return true;
  }

  // Check for wildcard permissions
  const resourceWildcard = `${resource}:*`;
  const actionWildcard = `*:${action}`;
  const fullWildcard = '*:*';

  return (
    userPermissions.includes(resourceWildcard) ||
    userPermissions.includes(actionWildcard) ||
    userPermissions.includes(fullWildcard)
  );
}

/**
 * Match subject pattern against user attributes (ABAC)
 */
function matchSubject(subject: string, user: User, userRoles: string[]): boolean {
  // Wildcard matches all
  if (subject === '*') {
    return true;
  }

  const colonIndex = subject.indexOf(':');
  if (colonIndex === -1) {
    // Try exact match with user id or username
    return subject === user.id || subject === user.username;
  }

  const type = subject.substring(0, colonIndex);
  const value = subject.substring(colonIndex + 1);

  switch (type) {
    case 'user':
      return user.id === value || user.username === value;

    case 'role':
      return userRoles.includes(value);

    case 'status':
      return user.status === value;

    case 'email':
      return user.email === value || (user.email?.endsWith(value.replace('*', '')) ?? false);

    default:
      return false;
  }
}

/**
 * Match resource pattern against requested resource (ABAC)
 */
function matchResource(pattern: string, resource: string): boolean {
  // Exact match
  if (pattern === resource) {
    return true;
  }

  // Wildcard match all
  if (pattern === '*') {
    return true;
  }

  // Prefix wildcard match (e.g., "user:*" matches "user", "user:profile", etc.)
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -2);
    return resource === prefix || resource.startsWith(`${prefix}:`);
  }

  // Suffix wildcard match
  if (pattern.startsWith('*:')) {
    const suffix = pattern.slice(2);
    return resource.endsWith(suffix);
  }

  return false;
}

/**
 * Match action pattern against requested action (ABAC)
 */
function matchAction(pattern: string, action: string): boolean {
  // Wildcard matches all
  if (pattern === '*') {
    return true;
  }

  // Comma-separated actions
  if (pattern.includes(',')) {
    const actions = pattern.split(',').map((a) => a.trim());
    return actions.includes(action);
  }

  // Exact match
  return pattern === action;
}

/**
 * Evaluate conditions (simplified version)
 */
function evaluateConditions(conditions: Record<string, unknown> | null, _user: User): boolean {
  if (!conditions) {
    return true;
  }

  // Time-based conditions
  if (conditions.time) {
    const timeConditions = conditions.time as Record<string, string>;
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (timeConditions.after && currentTime < timeConditions.after) {
      return false;
    }
    if (timeConditions.before && currentTime > timeConditions.before) {
      return false;
    }
  }

  return true;
}

/**
 * Evaluate ABAC permission for a user
 */
async function evaluateAbac(
  user: User,
  resource: string,
  action: string,
  policies: Policy[],
  userRoles: string[]
): Promise<boolean> {
  // Check if user is active
  if (user.status !== 'active') {
    return false;
  }

  // Evaluate each policy in priority order
  for (const policy of policies) {
    const subjectMatch = matchSubject(policy.subject, user, userRoles);
    const resourceMatch = matchResource(policy.resource, resource);
    const actionMatch = matchAction(policy.action, action);

    if (subjectMatch && resourceMatch && actionMatch) {
      // Check conditions if present
      if (policy.conditions && !evaluateConditions(policy.conditions, user)) {
        continue;
      }

      return policy.effect === 'allow';
    }
  }

  // Default: deny access
  return false;
}

/**
 * Get user roles
 */
async function getUserRoles(userId: string): Promise<string[]> {
  const query = `
    SELECT r.name
    FROM roles r
    INNER JOIN user_roles ur ON r.id = ur.role_id
    WHERE ur.user_id = $1
  `;

  const result = await dataSource.query<{ name: string }[]>(query, [userId]);
  return result.map((r) => r.name);
}

/**
 * Main verification function
 */
async function verifyMigration(): Promise<void> {
  const args = parseArgs();

  try {
    // Connect to database
    console.error('Connecting to database...');
    await dataSource.initialize();
    console.error('Database connected successfully');

    // Query all permissions
    const permissions = await dataSource.query<Permission[]>(`
      SELECT id, name, resource, action
      FROM permissions
      ORDER BY resource, action
    `);

    // Query all enabled ABAC policies
    const policies = await dataSource.query<Policy[]>(`
      SELECT id, name, effect, subject, resource, action, conditions, priority, enabled
      FROM policies
      WHERE enabled = true
      ORDER BY priority DESC, resource, action
    `);

    console.error(
      `Found ${permissions.length} permissions and ${policies.length} enabled policies`
    );

    // Query users
    let users: User[];
    if (args.userId) {
      users = await dataSource.query<User[]>(
        `SELECT id, username, email, phone, status FROM users WHERE id = $1`,
        [args.userId]
      );
      if (users.length === 0) {
        console.error(`User with ID ${args.userId} not found`);
        process.exit(1);
      }
    } else {
      users = await dataSource.query<User[]>(`
        SELECT id, username, email, phone, status
        FROM users
        WHERE deleted_at IS NULL
        ORDER BY username
      `);
    }

    console.error(`Verifying ${users.length} user(s)...`);

    const mismatches: Mismatch[] = [];
    let totalChecks = 0;
    let matching = 0;

    // For each user
    for (const user of users) {
      // Get user's RBAC permissions
      const rbacPermissions = await getRbacPermissions(user.id);

      // Get user's roles for ABAC evaluation
      const userRoles = await getUserRoles(user.id);

      if (args.verbose) {
        console.error(`\nUser: ${user.username} (${user.id})`);
        console.error(`  Roles: ${userRoles.join(', ') || 'none'}`);
        console.error(`  RBAC permissions: ${rbacPermissions.length}`);
      }

      // For each permission
      for (const perm of permissions) {
        totalChecks++;

        // Evaluate RBAC
        const rbacResult = hasRbacPermission(
          perm.name,
          perm.resource,
          perm.action,
          rbacPermissions
        );

        // Evaluate ABAC
        const abacResult = await evaluateAbac(
          user,
          perm.resource,
          perm.action,
          policies,
          userRoles
        );

        // Compare results
        if (rbacResult !== abacResult) {
          mismatches.push({
            user_id: user.id,
            username: user.username,
            permission: perm.name,
            resource: perm.resource,
            action: perm.action,
            rbac_result: rbacResult,
            abac_result: abacResult,
          });
        } else {
          matching++;
        }

        if (args.verbose) {
          const status = rbacResult === abacResult ? '✓' : '✗';
          console.error(`  ${status} ${perm.name}: RBAC=${rbacResult}, ABAC=${abacResult}`);
        }
      }
    }

    // Generate report
    const report: VerificationReport = {
      total_users: users.length,
      total_permissions_checked: totalChecks,
      matching,
      mismatching: mismatches.length,
      mismatches,
      timestamp: new Date().toISOString(),
    };

    console.log(JSON.stringify(report, null, 2));

    // Exit with error code if there are mismatches
    if (mismatches.length > 0) {
      console.error(`\nVerification found ${mismatches.length} mismatch(es)`);
      process.exit(1);
    } else {
      console.error('\nVerification passed: All permissions match');
      process.exit(0);
    }
  } catch (error) {
    console.error('Error during verification:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

// Run the verification
verifyMigration();
