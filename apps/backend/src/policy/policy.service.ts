import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Policy } from '../entities/policy.entity';
import { PolicyPermission } from '../entities/policy-permission.entity';
import { Permission } from '../entities/permission.entity';
import { CreatePolicyDto, UpdatePolicyDto, QueryPolicyDto } from './dto';

@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(Policy)
    private readonly policyRepo: Repository<Policy>,
    @InjectRepository(PolicyPermission)
    private readonly policyPermissionRepo: Repository<PolicyPermission>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>
  ) {}

  /**
   * Create a new policy
   */
  async create(dto: CreatePolicyDto): Promise<Policy> {
    const policy = this.policyRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      effect: dto.effect,
      subject: dto.subject,
      resource: dto.resource,
      action: dto.action,
      conditions: dto.conditions ?? null,
      priority: dto.priority ?? 0,
      enabled: dto.enabled ?? true,
    });

    return this.policyRepo.save(policy);
  }

  /**
   * Find all policies with optional filtering and pagination
   */
  async findAll(query: QueryPolicyDto): Promise<{ data: Policy[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Policy> = {};

    if (query.name) {
      where.name = Like(`%${query.name}%`);
    }
    if (query.subject) {
      where.subject = Like(`%${query.subject}%`);
    }
    if (query.resource) {
      where.resource = Like(`%${query.resource}%`);
    }
    if (query.action) {
      where.action = Like(`%${query.action}%`);
    }
    if (query.enabled !== undefined) {
      where.enabled = query.enabled;
    }

    const [data, total] = await this.policyRepo.findAndCount({
      where,
      order: { priority: 'DESC', createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }

  /**
   * Find a policy by ID
   */
  async findOne(id: string): Promise<Policy> {
    const policy = await this.policyRepo.findOne({ where: { id } });
    if (!policy) {
      throw new NotFoundException(`Policy with ID "${id}" not found`);
    }
    return policy;
  }

  /**
   * Update a policy
   */
  async update(id: string, dto: UpdatePolicyDto): Promise<Policy> {
    const policy = await this.findOne(id);

    // Update only provided fields using Object.assign
    Object.assign(policy, dto);

    return this.policyRepo.save(policy);
  }

  /**
   * Delete a policy
   */
  async remove(id: string): Promise<void> {
    const policy = await this.findOne(id);
    await this.policyRepo.remove(policy);
  }

  /**
   * Get all enabled policies ordered by priority (for policy evaluation)
   */
  async getEnabledPolicies(): Promise<Policy[]> {
    return this.policyRepo.find({
      where: { enabled: true },
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  /**
   * Get all enabled policies with PolicyPermission relations loaded
   * Used by PolicyEvaluatorService for ABAC evaluation with permission-based matching
   */
  async getEnabledPoliciesWithPermissions(): Promise<Policy[]> {
    return this.policyRepo.find({
      where: { enabled: true },
      relations: ['policyPermissions', 'policyPermissions.permission'],
      order: { priority: 'DESC', createdAt: 'ASC' },
    });
  }

  /**
   * Find policies by subject pattern
   */
  async findBySubject(subject: string): Promise<Policy[]> {
    return this.policyRepo.find({
      where: { subject: Like(`%${subject}%`), enabled: true },
      order: { priority: 'DESC' },
    });
  }

  /**
   * Check if any policy exists for a given resource/action combination
   */
  async hasPolicyForResource(resource: string, action: string): Promise<boolean> {
    const count = await this.policyRepo.count({
      where: {
        resource: Like(`%${resource}%`),
        action: Like(`%${action}%`),
        enabled: true,
      },
    });
    return count > 0;
  }

  /**
   * Assign a permission to a policy
   */
  async assignPermissionToPolicy(
    policyId: string,
    permissionId: string
  ): Promise<PolicyPermission> {
    // Verify policy exists
    await this.findOne(policyId);

    // Verify permission exists
    const permission = await this.permissionRepo.findOne({ where: { id: permissionId } });
    if (!permission) {
      throw new NotFoundException(`Permission with ID "${permissionId}" not found`);
    }

    // Check if already assigned
    const existing = await this.policyPermissionRepo.findOne({
      where: { policyId, permissionId },
    });
    if (existing) {
      throw new ConflictException('Permission already assigned to this policy');
    }

    const policyPermission = this.policyPermissionRepo.create({
      policyId,
      permissionId,
    });

    return this.policyPermissionRepo.save(policyPermission);
  }

  /**
   * Remove a permission from a policy
   */
  async removePermissionFromPolicy(policyId: string, permissionId: string): Promise<void> {
    const policyPermission = await this.policyPermissionRepo.findOne({
      where: { policyId, permissionId },
    });
    if (!policyPermission) {
      throw new NotFoundException(`Permission "${permissionId}" not found on policy "${policyId}"`);
    }
    await this.policyPermissionRepo.remove(policyPermission);
  }

  /**
   * Get all permissions for a policy
   */
  async getPolicyPermissions(policyId: string): Promise<Permission[]> {
    // Verify policy exists
    await this.findOne(policyId);

    const policyPermissions = await this.policyPermissionRepo.find({
      where: { policyId },
    });

    if (policyPermissions.length === 0) {
      return [];
    }

    const permissionIds = policyPermissions.map((pp) => pp.permissionId);
    return this.permissionRepo.findByIds(permissionIds);
  }
}
