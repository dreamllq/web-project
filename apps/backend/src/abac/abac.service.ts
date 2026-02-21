import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { Policy } from '../entities/policy.entity';
import { Role } from '../entities/role.entity';
import { User } from '../entities/user.entity';
import { PolicyEvaluatorService } from '../policy/policy-evaluator.service';
import { TestPermissionDto } from './dto/test-permission.dto';

export interface CoverageResponse {
  rbac_count: number;
  abac_count: number;
  enabled_abac_count: number;
  coverage_percent: number;
  missing_policies: Array<{ resource: string; action: string; permission_name: string }>;
  role_coverage: Array<{ role: string; policies: number; permissions: number }>;
}

export interface TestPermissionResult {
  allowed: boolean;
  user: {
    id: string;
    username: string;
    roles: string[];
  };
  resource: string;
  action: string;
  matchedPolicies: Array<{
    id: string;
    name: string;
    effect: string;
    subject: string;
    priority: number;
  }>;
  evaluationTimeMs: number;
}

@Injectable()
export class AbacService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(Policy)
    private readonly policyRepo: Repository<Policy>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly policyEvaluator: PolicyEvaluatorService
  ) {}

  /**
   * Check if an ABAC policy covers an RBAC permission
   */
  private policyCoversPermission(policy: Policy, permission: Permission): boolean {
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
   * Get ABAC coverage statistics
   * Compares RBAC permissions with ABAC policies and calculates coverage
   */
  async getCoverage(): Promise<CoverageResponse> {
    // Query all RBAC permissions
    const permissions = await this.permissionRepo.find({
      order: { resource: 'ASC', action: 'ASC' },
    });

    // Query all ABAC policies
    const policies = await this.policyRepo.find({
      order: { priority: 'DESC', resource: 'ASC', action: 'ASC' },
    });

    // Get all roles with their permissions
    const roles = await this.roleRepo.find({
      relations: ['permissions'],
      order: { name: 'ASC' },
    });

    const enabledPolicies = policies.filter((p) => p.enabled);

    // Find missing and covered permissions
    const missingPolicies: CoverageResponse['missing_policies'] = [];

    for (const permission of permissions) {
      // Check against enabled policies only for coverage
      const isCovered = enabledPolicies.some((policy) =>
        this.policyCoversPermission(policy, permission)
      );

      if (!isCovered) {
        missingPolicies.push({
          resource: permission.resource,
          action: permission.action,
          permission_name: permission.name,
        });
      }
    }

    // Calculate coverage percentage
    const rbacCount = permissions.length;
    const abacCount = policies.length;
    const enabledAbacCount = enabledPolicies.length;
    const coveredCount = rbacCount - missingPolicies.length;
    const coveragePercent =
      rbacCount > 0 ? Math.round((coveredCount / rbacCount) * 100 * 10) / 10 : 0;

    // Calculate role coverage
    const roleCoverage = roles.map((role) => {
      // Count policies that apply to this role via subject pattern
      const rolePolicies = enabledPolicies.filter((policy) => {
        const subjectMatch =
          policy.subject === '*' ||
          policy.subject === `role:${role.name}` ||
          policy.subject.includes(`role:${role.name}`);
        return subjectMatch;
      });

      return {
        role: role.name,
        policies: rolePolicies.length,
        permissions: role.permissions.length,
      };
    });

    return {
      rbac_count: rbacCount,
      abac_count: abacCount,
      enabled_abac_count: enabledAbacCount,
      coverage_percent: coveragePercent,
      missing_policies: missingPolicies,
      role_coverage: roleCoverage,
    };
  }

  /**
   * Test permission evaluation for a specific user
   * Returns detailed results including matched policies
   */
  async testPermission(dto: TestPermissionDto): Promise<TestPermissionResult> {
    const startTime = Date.now();

    // Fetch user with roles
    const user = await this.userRepo.findOne({
      where: { id: dto.userId },
      relations: ['roles'],
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${dto.userId} not found`);
    }

    // Use PolicyEvaluatorService to evaluate with details
    const evaluationResult = await this.policyEvaluator.evaluateWithDetails(
      user,
      dto.resource,
      dto.action
    );

    // Build matched policies array
    const matchedPolicies: Array<{
      id: string;
      name: string;
      effect: string;
      subject: string;
      priority: number;
    }> = [];

    if (evaluationResult.matchedPolicy) {
      matchedPolicies.push({
        id: evaluationResult.matchedPolicy.id,
        name: evaluationResult.matchedPolicy.name,
        effect: evaluationResult.matchedPolicy.effect,
        subject: evaluationResult.matchedPolicy.subject,
        priority: evaluationResult.matchedPolicy.priority,
      });
    }

    const evaluationTimeMs = Date.now() - startTime;

    return {
      allowed: evaluationResult.allowed,
      user: {
        id: user.id,
        username: user.username,
        roles: user.roles?.map((role) => role.name) ?? [],
      },
      resource: dto.resource,
      action: dto.action,
      matchedPolicies,
      evaluationTimeMs,
    };
  }
}
