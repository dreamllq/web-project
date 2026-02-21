// ============================================
// ABAC (Attribute-Based Access Control) Types
// ============================================

/**
 * Missing policy definition
 * Represents a permission without an ABAC policy
 */
export interface MissingPolicy {
  resource: string;
  action: string;
  permission_name: string;
}

/**
 * Role coverage statistics
 * Shows how many policies and permissions each role has
 */
export interface RoleCoverage {
  role: string;
  policies: number;
  permissions: number;
}

/**
 * ABAC coverage response from API
 * Contains statistics about ABAC policy coverage
 */
export interface CoverageResponse {
  /** Total number of RBAC permissions */
  rbac_count: number;
  /** Total number of ABAC policies */
  abac_count: number;
  /** Number of enabled ABAC policies */
  enabled_abac_count: number;
  /** Percentage of permissions covered by ABAC */
  coverage_percent: number;
  /** List of permissions without ABAC policies */
  missing_policies: MissingPolicy[];
  /** Coverage breakdown by role */
  role_coverage: RoleCoverage[];
}

// ============================================
// ABAC Test Permission Types
// ============================================

/**
 * Request payload for testing user permission
 */
export interface TestPermissionDto {
  userId: string;
  resource: string;
  action: string;
}

/**
 * Matched policy in test result
 */
export interface MatchedPolicy {
  id: string;
  name: string;
  effect: string;
  subject: string;
  priority: number;
}

/**
 * User info in test result
 */
export interface TestPermissionUser {
  id: string;
  username: string;
  roles: string[];
}

/**
 * Response from permission test API
 */
export interface TestPermissionResult {
  allowed: boolean;
  user: TestPermissionUser;
  resource: string;
  action: string;
  matchedPolicies: MatchedPolicy[];
  evaluationTimeMs: number;
}
