import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Policy } from '../entities/policy.entity';
import { CreatePolicyDto, UpdatePolicyDto, QueryPolicyDto } from './dto';
import type { PolicySubject } from './types/policy.types';

@Injectable()
export class PolicyService {
  constructor(
    @InjectRepository(Policy)
    private readonly policyRepo: Repository<Policy>
  ) {}

  /**
   * Create a new policy
   */
  async create(dto: CreatePolicyDto): Promise<Policy> {
    const policy = this.policyRepo.create({
      name: dto.name,
      description: dto.description ?? null,
      effect: dto.effect,
      subject: dto.subject as PolicySubject,
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

    const queryBuilder = this.policyRepo.createQueryBuilder('policy');

    if (query.name) {
      queryBuilder.andWhere('policy.name LIKE :name', { name: `%${query.name}%` });
    }
    if (query.subjectType) {
      queryBuilder.andWhere("policy.subject->>'type' = :subjectType", {
        subjectType: query.subjectType,
      });
    }
    if (query.resource) {
      queryBuilder.andWhere('policy.resource LIKE :resource', { resource: `%${query.resource}%` });
    }
    if (query.action) {
      queryBuilder.andWhere('policy.action LIKE :action', { action: `%${query.action}%` });
    }
    if (query.enabled !== undefined) {
      queryBuilder.andWhere('policy.enabled = :enabled', { enabled: query.enabled });
    }

    queryBuilder
      .orderBy('policy.priority', 'DESC')
      .addOrderBy('policy.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

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

    // Update only provided fields
    if (dto.name !== undefined) policy.name = dto.name;
    if (dto.description !== undefined) policy.description = dto.description;
    if (dto.effect !== undefined) policy.effect = dto.effect;
    if (dto.subject !== undefined) policy.subject = dto.subject as PolicySubject;
    if (dto.resource !== undefined) policy.resource = dto.resource;
    if (dto.action !== undefined) policy.action = dto.action;
    if (dto.conditions !== undefined) policy.conditions = dto.conditions ?? null;
    if (dto.priority !== undefined) policy.priority = dto.priority;
    if (dto.enabled !== undefined) policy.enabled = dto.enabled;

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
   * Find policies by subject type and value
   */
  async findBySubject(type: string, value?: string): Promise<Policy[]> {
    const queryBuilder = this.policyRepo
      .createQueryBuilder('policy')
      .where('policy.enabled = :enabled', { enabled: true })
      .andWhere("policy.subject->>'type' = :type", { type });

    if (value) {
      queryBuilder.andWhere('policy.subject @> :value', {
        value: JSON.stringify({ value: [value] }),
      });
    }

    return queryBuilder.orderBy('policy.priority', 'DESC').getMany();
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
