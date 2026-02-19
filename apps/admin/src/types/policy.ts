// ============================================
// Policy (Attribute-Based Access Control) Types
// ============================================

/**
 * Policy effect determines whether access is granted or denied
 */
export type PolicyEffect = 'allow' | 'deny';

/**
 * Time-based condition for policy evaluation
 */
export interface TimeCondition {
  /** Start time (ISO 8601 format or HH:mm format) */
  start?: string;
  /** End time (ISO 8601 format or HH:mm format) */
  end?: string;
  /** Allowed days of week (0 = Sunday, 6 = Saturday) */
  daysOfWeek?: number[];
}

/**
 * IP-based condition for policy evaluation
 */
export interface IpCondition {
  /** Allowed IP addresses or CIDR ranges */
  allowed?: string[];
  /** Denied IP addresses or CIDR ranges */
  denied?: string[];
}

/**
 * Policy condition configuration
 * Supports time-based and IP-based access restrictions
 */
export interface PolicyCondition {
  time?: TimeCondition;
  ip?: IpCondition;
}

/**
 * Policy definition
 * Represents an ABAC policy rule in the system
 */
export interface Policy {
  id: string;
  name: string;
  description: string | null;
  effect: PolicyEffect;
  subject: string;
  resource: string;
  action: string;
  conditions: PolicyCondition | null;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Policy Management DTOs
// ============================================

/**
 * DTO for creating a new policy
 */
export interface CreatePolicyDto {
  name: string;
  description?: string;
  effect: PolicyEffect;
  subject: string;
  resource: string;
  action: string;
  conditions?: PolicyCondition;
  priority?: number;
  enabled?: boolean;
}

/**
 * DTO for updating an existing policy
 */
export interface UpdatePolicyDto {
  name?: string;
  description?: string;
  effect?: PolicyEffect;
  subject?: string;
  resource?: string;
  action?: string;
  conditions?: PolicyCondition;
  priority?: number;
  enabled?: boolean;
}

/**
 * DTO for querying policies with filters
 */
export interface QueryPolicyDto {
  subject?: string;
  resource?: string;
  action?: string;
  enabled?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================
// Policy Response Types
// ============================================

/**
 * Response wrapper for policy list API
 */
export interface PolicyListResponse {
  data: Policy[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * Response wrapper for single policy API
 */
export interface PolicyResponse {
  data: Policy;
}

// ============================================
// Permission Check Types
// ============================================

/**
 * Request payload for checking permissions
 */
export interface PermissionCheckRequest {
  resource: string;
  action: string;
  context?: {
    subject?: string;
    time?: string;
    ip?: string;
    [key: string]: string | number | boolean | undefined;
  };
}

/**
 * Response from permission check API
 */
export interface PermissionCheckResponse {
  allowed: boolean;
  matchedPolicy?: Policy;
}
