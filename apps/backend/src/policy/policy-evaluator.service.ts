import { Injectable, Logger } from '@nestjs/common';
import type { WhereExpression } from 'typeorm';
import { Policy, PolicyEffect } from '../entities/policy.entity';
import { User, UserStatus } from '../entities/user.entity';
import { PolicyService } from './policy.service';
import type {
  PolicySubject,
  ConditionExpression,
  Condition,
  ConditionOperator,
} from './types/policy.types';

/**
 * User attributes interface for ABAC evaluation
 * These attributes are matched against policy subjects
 */
export interface UserAttributes {
  id: string;
  username: string;
  email?: string | null;
  phone?: string | null;
  status: UserStatus;
  roles?: string[];
  departments?: string[];
  customAttributes?: Record<string, unknown>;
}

/**
 * Policy evaluation context
 */
export interface EvaluationContext {
  user: User | UserAttributes;
  resource: string;
  action: string;
  environment?: Record<string, unknown>;
}

/**
 * Policy evaluation result
 */
export interface EvaluationResult {
  allowed: boolean;
  matchedPolicy?: Policy;
  reason: string;
}

/**
 * Data access validation result
 */
export interface DataAccessValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Policy Evaluator Service
 *
 * Implements ABAC (Attribute-Based Access Control) by:
 * 1. Loading enabled policies ordered by priority
 * 2. Matching user attributes against policy subjects
 * 3. Matching resource and action patterns
 * 4. Returning allow/deny based on first matching policy
 */
@Injectable()
export class PolicyEvaluatorService {
  private readonly logger = new Logger(PolicyEvaluatorService.name);
  private policyCache: Policy[] | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_TTL = 60000; // 1 minute cache

  constructor(private readonly policyService: PolicyService) {}

  /**
   * Evaluate if a user has permission to perform an action on a resource
   *
   * @param user - The user to check permissions for
   * @param resource - The resource being accessed (e.g., "user", "policy", "file")
   * @param action - The action being performed (e.g., "read", "write", "delete")
   * @returns true if the user has permission, false otherwise
   */
  async evaluate(user: User | UserAttributes, resource: string, action: string): Promise<boolean> {
    const result = await this.evaluateWithDetails(user, resource, action);
    return result.allowed;
  }

  /**
   * Evaluate with detailed result including which policy matched
   */
  async evaluateWithDetails(
    user: User | UserAttributes,
    resource: string,
    action: string,
    environment?: Record<string, unknown>
  ): Promise<EvaluationResult> {
    const startTime = Date.now();

    // Get user attributes
    const userAttrs = this.extractUserAttributes(user);

    // Check if user is active
    if (userAttrs.status !== UserStatus.ACTIVE) {
      this.logger.debug({
        message: 'Policy evaluation rejected: inactive user',
        userId: userAttrs.id,
        username: userAttrs.username,
        status: userAttrs.status,
        resource,
        action,
        evaluationTimeMs: Date.now() - startTime,
      });

      return {
        allowed: false,
        reason: `User status is ${userAttrs.status}, not active`,
      };
    }

    // Get enabled policies (from cache or database)
    const policies = await this.getPolicies();

    // Evaluate each policy in priority order
    for (const policy of policies) {
      const subjectMatch = this.matchSubject(policy.subject, userAttrs);
      const resourceMatch = this.matchResource(policy.resource, resource);
      const actionMatch = this.matchAction(policy.action, action);

      if (subjectMatch && resourceMatch && actionMatch) {
        // Check conditions if present
        if (
          policy.conditions &&
          !this.evaluateConditions(policy.conditions, userAttrs, environment)
        ) {
          this.logger.debug({
            message: 'Policy matched but conditions not satisfied',
            policyName: policy.name,
            policyId: policy.id,
            userId: userAttrs.id,
            resource,
            action,
            conditions: policy.conditions,
            evaluationTimeMs: Date.now() - startTime,
          });
          continue;
        }

        // Build match reason string
        const matchReason = this.buildMatchReason(
          policy.subject,
          policy.resource,
          policy.action,
          userAttrs
        );

        this.logger.debug({
          message: 'Policy evaluation complete: policy matched',
          policyName: policy.name,
          policyId: policy.id,
          userId: userAttrs.id,
          username: userAttrs.username,
          resource,
          action,
          result: policy.effect,
          matchReason,
          evaluationTimeMs: Date.now() - startTime,
        });

        return {
          allowed: policy.effect === PolicyEffect.ALLOW,
          matchedPolicy: policy,
          reason: `Policy "${policy.name}" ${policy.effect}s ${action} on ${resource}`,
        };
      }
    }

    // Default: deny access
    this.logger.debug({
      message: 'Policy evaluation complete: no matching policy',
      userId: userAttrs.id,
      username: userAttrs.username,
      resource,
      action,
      result: 'DENY',
      evaluationTimeMs: Date.now() - startTime,
    });

    return {
      allowed: false,
      reason: `No matching policy found for user ${userAttrs.username} to ${action} on ${resource}`,
    };
  }

  /**
   * Generate TypeORM WHERE conditions for data filtering
   * Used for read operations to filter data based on ABAC policies
   *
   * @param user - The user requesting access
   * @param resource - The resource type being accessed
   * @param action - The action being performed
   * @returns Array of TypeORM WhereExpression for data filtering
   */
  async getDataFilterConditions(
    user: User | UserAttributes,
    resource: string,
    action: string
  ): Promise<WhereExpression[]> {
    const userAttrs = this.extractUserAttributes(user);

    // Get policies that match this user, resource, and action
    const policies = await this.getPolicies();
    const matchingPolicies = policies.filter((policy) => {
      const subjectMatch = this.matchSubject(policy.subject, userAttrs);
      const resourceMatch = this.matchResource(policy.resource, resource);
      const actionMatch = this.matchAction(policy.action, action);
      return subjectMatch && resourceMatch && actionMatch && policy.effect === PolicyEffect.ALLOW;
    });

    // For now, return empty array - full implementation would convert
    // policy conditions to TypeORM where expressions
    // This will be enhanced in future iterations to support data-level ABAC
    this.logger.debug({
      message: 'Data filter conditions generated',
      userId: userAttrs.id,
      resource,
      action,
      matchingPoliciesCount: matchingPolicies.length,
    });

    return [];
  }

  /**
   * Check if user can access a specific data record
   * Used for write operations to verify data-level permissions
   *
   * @param user - The user requesting access
   * @param resource - The resource type being accessed
   * @param action - The action being performed
   * @param dataId - The ID of the specific data record
   * @returns true if the user can access the data, false otherwise
   */
  async canAccessData(
    user: User | UserAttributes,
    resource: string,
    action: string,
    dataId: string
  ): Promise<boolean> {
    const userAttrs = this.extractUserAttributes(user);

    // First check basic permission
    const hasPermission = await this.evaluate(user, resource, action);
    if (!hasPermission) {
      return false;
    }

    // For now, if basic permission passes, allow access
    // Full implementation would check data-level conditions
    // This will be enhanced in future iterations
    this.logger.debug({
      message: 'Data access check completed',
      userId: userAttrs.id,
      resource,
      action,
      dataId,
      result: true,
    });

    return true;
  }

  /**
   * Validate input data against ABAC policies
   * Used to ensure input data complies with policies
   *
   * @param user - The user submitting the data
   * @param resource - The resource type being modified
   * @param inputData - The input data to validate
   * @returns Validation result with valid flag and optional reason
   */
  async validateInputData(
    user: User | UserAttributes,
    resource: string,
    inputData: Record<string, unknown>
  ): Promise<DataAccessValidationResult> {
    const userAttrs = this.extractUserAttributes(user);

    // Basic validation - check if user has write permission on resource
    const hasWritePermission = await this.evaluate(user, resource, 'write');
    if (!hasWritePermission) {
      return {
        valid: false,
        reason: `User ${userAttrs.username} does not have write permission on ${resource}`,
      };
    }

    // For now, return valid if basic permission passes
    // Full implementation would validate against field-level policies
    // This will be enhanced in future iterations
    this.logger.debug({
      message: 'Input data validation completed',
      userId: userAttrs.id,
      resource,
      inputKeys: Object.keys(inputData),
      result: true,
    });

    return { valid: true };
  }

  /**
   * Build a human-readable match reason string
   */
  private buildMatchReason(
    subject: PolicySubject,
    resourcePattern: string,
    actionPattern: string,
    _userAttrs: UserAttributes
  ): string {
    const parts: string[] = [];

    // Subject match reason
    parts.push(
      `subject:${subject.type}:${Array.isArray(subject.value) ? subject.value.join(',') : subject.value}`
    );

    // Resource match reason
    parts.push(`resource:${resourcePattern}`);

    // Action match reason
    parts.push(`action:${actionPattern}`);

    return parts.join(', ');
  }

  /**
   * Extract user attributes from User entity or UserAttributes object
   */
  private extractUserAttributes(user: User | UserAttributes): UserAttributes {
    if ('id' in user && 'username' in user) {
      // It's either a User entity or UserAttributes
      if ('passwordHash' in user) {
        // It's a User entity
        const userEntity = user as User;
        return {
          id: userEntity.id,
          username: userEntity.username,
          email: userEntity.email,
          phone: userEntity.phone,
          status: userEntity.status,
          roles: userEntity.roles?.map((role) => role.name) ?? [],
          departments: [], // Departments would be loaded from user-department relationship
          customAttributes: {},
        };
      }
      // It's already UserAttributes
      return user as UserAttributes;
    }
    throw new Error('Invalid user object provided');
  }

  /**
   * Match subject definition against user attributes
   *
   * Supports:
   * - type: 'all' - Match all users
   * - type: 'user' - Match specific user ID(s) or username(s)
   * - type: 'role' - Match user with specific role(s)
   * - type: 'department' - Match user in specific department(s)
   */
  private matchSubject(subject: PolicySubject, userAttrs: UserAttributes): boolean {
    switch (subject.type) {
      case 'all':
        return true;

      case 'user': {
        const values = Array.isArray(subject.value) ? subject.value : [subject.value];
        return values.some((v) => userAttrs.id === v || userAttrs.username === v);
      }

      case 'role': {
        const roleValues = Array.isArray(subject.value) ? subject.value : [subject.value];
        return roleValues.some((v) => userAttrs.roles?.includes(v) ?? false);
      }

      case 'department': {
        const deptValues = Array.isArray(subject.value) ? subject.value : [subject.value];
        return deptValues.some((v) => userAttrs.departments?.includes(v) ?? false);
      }

      default:
        return false;
    }
  }

  /**
   * Match resource pattern against requested resource
   *
   * Supported patterns:
   * - "resource" - Exact match
   * - "resource:*" - Match resource with any sub-resource
   * - "*" - Match all resources
   * - "prefix:*" - Match any resource starting with prefix
   */
  private matchResource(pattern: string, resource: string): boolean {
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

    // Middle wildcard match (e.g., "user:*:read")
    if (pattern.includes(':*:')) {
      const parts = pattern.split(':*:');
      if (parts.length === 2) {
        const [prefix, suffix] = parts;
        return resource.startsWith(`${prefix}:`) && resource.endsWith(`:${suffix}`);
      }
    }

    return false;
  }

  /**
   * Match action pattern against requested action
   *
   * Supported patterns:
   * - "action" - Exact match (e.g., "read", "write")
   * - "*" - Match all actions
   * - "action1,action2" - Match any of comma-separated actions
   */
  private matchAction(pattern: string, action: string): boolean {
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
   * Evaluate policy conditions against user attributes and environment
   *
   * ConditionExpression supports:
   * - and: Array of conditions (max 3, all must be true)
   * - condition: Single condition shorthand
   */
  private evaluateConditions(
    conditions: ConditionExpression,
    userAttrs: UserAttributes,
    environment?: Record<string, unknown>
  ): boolean {
    // Handle single condition shorthand
    const conditionList = conditions.and ?? (conditions.condition ? [conditions.condition] : []);

    // Max 3 conditions (AND logic)
    for (const condition of conditionList.slice(0, 3)) {
      if (!this.evaluateCondition(condition, userAttrs, environment)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: Condition,
    userAttrs: UserAttributes,
    environment?: Record<string, unknown>
  ): boolean {
    const resolvedValue = this.resolveValue(
      condition.value,
      condition.valueType ?? 'literal',
      userAttrs,
      environment
    );
    const fieldValue = this.getFieldValue(condition.field, userAttrs, environment);

    return this.applyOperator(fieldValue, condition.operator, resolvedValue);
  }

  /**
   * Apply comparison operator
   */
  private applyOperator(
    fieldValue: unknown,
    operator: ConditionOperator,
    resolvedValue: unknown
  ): boolean {
    switch (operator) {
      case 'eq':
        return fieldValue === resolvedValue;

      case 'ne':
        return fieldValue !== resolvedValue;

      case 'gt':
        return typeof fieldValue === 'number' && typeof resolvedValue === 'number'
          ? fieldValue > resolvedValue
          : false;

      case 'gte':
        return typeof fieldValue === 'number' && typeof resolvedValue === 'number'
          ? fieldValue >= resolvedValue
          : false;

      case 'lt':
        return typeof fieldValue === 'number' && typeof resolvedValue === 'number'
          ? fieldValue < resolvedValue
          : false;

      case 'lte':
        return typeof fieldValue === 'number' && typeof resolvedValue === 'number'
          ? fieldValue <= resolvedValue
          : false;

      case 'in':
        return Array.isArray(resolvedValue) && resolvedValue.includes(fieldValue as string);

      case 'nin':
        return Array.isArray(resolvedValue) && !resolvedValue.includes(fieldValue as string);

      case 'like':
        return (
          typeof fieldValue === 'string' &&
          typeof resolvedValue === 'string' &&
          fieldValue.includes(resolvedValue)
        );

      case 'isNull':
        return fieldValue === null || fieldValue === undefined;

      default:
        return false;
    }
  }

  /**
   * Resolve a condition value based on its valueType
   *
   * - literal: Use the value directly
   * - userAttr: Look up user attribute
   * - env: Look up environment variable
   */
  private resolveValue(
    value: string | number | boolean | null | string[],
    valueType: 'literal' | 'userAttr' | 'env',
    userAttrs: UserAttributes,
    environment?: Record<string, unknown>
  ): unknown {
    switch (valueType) {
      case 'userAttr':
        return this.getFieldValue(String(value), userAttrs);

      case 'env':
        return environment?.[String(value)];

      default:
        return value;
    }
  }

  /**
   * Get a field value from user attributes or environment
   * Supports nested field access like 'department.id'
   */
  private getFieldValue(
    field: string,
    userAttrs: UserAttributes,
    environment?: Record<string, unknown>
  ): unknown {
    // Check if field references an environment variable
    if (field.startsWith('env.')) {
      const envField = field.slice(4);
      return environment?.[envField];
    }

    // Support nested field access like 'customAttributes.departmentId'
    const parts = field.split('.');
    let value: unknown = userAttrs;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Get policies from cache or database
   */
  private async getPolicies(): Promise<Policy[]> {
    const now = Date.now();

    if (this.policyCache && now < this.cacheExpiry) {
      return this.policyCache;
    }

    this.policyCache = await this.policyService.getEnabledPolicies();
    this.cacheExpiry = now + this.CACHE_TTL;

    return this.policyCache;
  }

  /**
   * Invalidate the policy cache
   */
  invalidateCache(): void {
    this.policyCache = null;
    this.cacheExpiry = 0;
    this.logger.debug('Policy cache invalidated');
  }

  /**
   * Bulk evaluate permissions for multiple resources/actions
   */
  async evaluateBulk(
    user: User | UserAttributes,
    requests: Array<{ resource: string; action: string }>
  ): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const req of requests) {
      const key = `${req.resource}:${req.action}`;
      results[key] = await this.evaluate(user, req.resource, req.action);
    }

    return results;
  }
}
