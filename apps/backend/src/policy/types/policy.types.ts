/**
 * Policy Type Definitions for ABAC System
 *
 * These types define the structure for policy subjects and conditions
 * used in the attribute-based access control (ABAC) implementation.
 */

/**
 * ABAC Condition Operator types
 */
export type ConditionOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'like'
  | 'isNull';

/**
 * Value type for condition values
 * - literal: direct value (e.g., "active", 100)
 * - userAttr: user attribute reference (e.g., "departmentId", "id")
 * - env: environment variable reference (e.g., "NOW", "TENANT_ID")
 */
export type ConditionValueType = 'literal' | 'userAttr' | 'env';

/**
 * Single condition definition
 */
export interface Condition {
  /** Field name to check (e.g., "status", "departmentId", "createdById") */
  field: string;
  /** Comparison operator */
  operator: ConditionOperator;
  /** Value to compare against */
  value: string | number | boolean | null | string[];
  /** How to interpret the value */
  valueType?: ConditionValueType;
}

/**
 * Condition expression - supports AND only, max 3 conditions
 */
export interface ConditionExpression {
  /** AND operator - all conditions must be true */
  and?: Condition[];
  /** Single condition (shorthand for and: [condition]) */
  condition?: Condition;
}

/**
 * Subject definition - who this policy applies to
 */
export interface SubjectDefinition {
  /** Subject type */
  type: 'role' | 'user' | 'department' | 'all';
  /** Subject value - roleId/userId/departmentId or array of IDs */
  value: string | string[];
}

/**
 * Policy subject for JSONB storage
 */
export type PolicySubject = SubjectDefinition;
