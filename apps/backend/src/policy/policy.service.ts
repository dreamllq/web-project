import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { Policy } from '../entities/policy.entity';
import { CreatePolicyDto, UpdatePolicyDto, QueryPolicyDto } from './dto';

@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(Policy)
    private readonly policyRepo: Repository<Policy>,
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
}
