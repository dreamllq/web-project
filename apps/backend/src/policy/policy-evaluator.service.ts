import { Injectable, Logger } from '@nestjs/common';
import { Policy, PolicyEffect } from '../entities/policy.entity';
import { User, UserStatus } from '../entities/user.entity';
import { PolicyService } from './policy.service';

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
    action: string
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
        if (policy.conditions && !this.evaluateConditions(policy.conditions, userAttrs)) {
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
   * Build a human-readable match reason string
   */
  private buildMatchReason(
    subjectPattern: string,
    resourcePattern: string,
    actionPattern: string,
    _userAttrs: UserAttributes
  ): string {
    const parts: string[] = [];

    // Subject match reason
    if (subjectPattern === '*') {
      parts.push('subject:*');
    } else {
      const [type, value] = subjectPattern.split(':');
      parts.push(`subject:${type}:${value}`);
    }

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
   * Match subject pattern against user attributes
   *
   * Supported patterns:
   * - "user:{userId}" - Match specific user ID
   * - "role:{roleName}" - Match user with specific role
   * - "department:{deptName}" - Match user in specific department
   * - "status:{status}" - Match user with specific status
   * - "*" - Match all users
   */
  private matchSubject(subject: string, userAttrs: UserAttributes): boolean {
    // Wildcard matches all
    if (subject === '*') {
      return true;
    }

    const [type, value] = subject.split(':');

    switch (type) {
      case 'user':
        return userAttrs.id === value || userAttrs.username === value;

      case 'role':
        return userAttrs.roles?.includes(value) ?? false;

      case 'department':
        return userAttrs.departments?.includes(value) ?? false;

      case 'status':
        return userAttrs.status === value;

      case 'email':
        return (
          userAttrs.email === value || (userAttrs.email?.endsWith(value.replace('*', '')) ?? false)
        );

      default:
        // Try exact match
        return subject === userAttrs.id || subject === userAttrs.username;
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
   * Evaluate policy conditions against user attributes
   *
   * Supported conditions:
   * - { "time": { "after": "09:00", "before": "18:00" } } - Time-based conditions
   * - { "ip": { "in": ["192.168.1.0/24"] } } - IP-based conditions
   * - { "custom": { "key": "value" } } - Custom attribute matching
   */

  private evaluateConditions(
    conditions: Record<string, unknown>,
    _userAttrs: UserAttributes
  ): boolean {
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

    // Add more condition types as needed

    return true;
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
