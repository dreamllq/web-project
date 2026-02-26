import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Version,
  Req,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PolicyService } from './policy.service';
import { PolicyEvaluatorService } from './policy-evaluator.service';
import { SubjectTypeRegistryService } from './services/subject-type-registry.service';
import { CreatePolicyDto, UpdatePolicyDto, QueryPolicyDto } from './dto';
import { RequirePermission } from './decorators/require-permission.decorator';
import { PermissionGuard } from './guards/permission.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Policy } from '../entities/policy.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { Permission } from '../entities/permission.entity';
import { ApplyDataFilter } from './decorators/apply-data-filter.decorator';
import { DataFilterInterceptor, RequestWithDataFilter } from './interceptors/data-filter.interceptor';

@ApiTags('policies')
@Controller('policies')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class PolicyController {
  /**
   * ABAC Policy Management Endpoints
   *
   * Authorization: All endpoints require ABAC policy evaluation.
   * These endpoints manage the ABAC policies used for authorization.
   * See docs/api-authentication.md for details on ABAC authorization.
   */
  constructor(
    private readonly policyService: PolicyService,
    private readonly policyEvaluator: PolicyEvaluatorService,
    private readonly subjectTypeRegistry: SubjectTypeRegistryService,
    @InjectRepository(Permission)
    private readonly permissionRepository: Repository<Permission>
  ) {}

  /**
   * Create a new policy
   * POST /api/v1/policies
   */
  @Post()
  @Version('1')
  @RequirePermission('policy', 'create')
  @ApiOperation({ summary: 'Create a new ABAC policy' })
  @ApiResponse({ status: 201, description: 'Policy created successfully' })
  async create(@Body() dto: CreatePolicyDto): Promise<Policy> {
    const policy = await this.policyService.create(dto);
    // Invalidate cache when policy is created
    this.policyEvaluator.invalidateCache();
    return policy;
  }

  /**
   * List all policies with optional filtering and pagination
   * GET /api/v1/policies
   */
  @Get()
  @Version('1')
  @RequirePermission('policy', 'read')
  @ApplyDataFilter(Policy)
  @UseInterceptors(DataFilterInterceptor)
  @ApiOperation({ summary: 'List all ABAC policies' })
  @ApiResponse({ status: 200, description: 'List of policies with pagination' })
  async findAll(
    @Query() query: QueryPolicyDto,
    @Req() req: RequestWithDataFilter
  ): Promise<{ data: Policy[]; total: number; page: number; limit: number }> {
    const { data, total } = await this.policyService.findAll(query, req);
    return {
      data,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  // ==================== Static Routes (MUST be before :id) ====================

  /**
   * Check current user's permission for a specific resource/action
   * GET /api/v1/policies/check/permission?resource=policy&action=read
   */
  @Get('check/permission')
  @Version('1')
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Check if current user has permission for a resource/action' })
  @ApiQuery({ name: 'resource', description: 'Resource name (e.g., user, policy)' })
  @ApiQuery({ name: 'action', description: 'Action name (e.g., read, create)' })
  @ApiResponse({ status: 200, description: 'Permission check result' })
  async checkPermission(
    @CurrentUser() user: User,
    @Query('resource') resource: string,
    @Query('action') action: string
  ): Promise<{ allowed: boolean; resource: string; action: string }> {
    const allowed = await this.policyEvaluator.evaluate(user, resource, action);
    return { allowed, resource, action };
  }

  /**
   * Get all registered subject types
   * GET /api/v1/policies/subject-types
   */
  @Get('subject-types')
  @Version('1')
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Get all registered subject types for policy assignment' })
  @ApiResponse({
    status: 200,
    description: 'List of subject types',
    schema: {
      type: 'object',
      properties: {
        types: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', example: 'role' },
              label: { type: 'string', example: '角色' },
            },
          },
        },
      },
    },
  })
  async getSubjectTypes(): Promise<{ types: Array<{ type: string; label: string }> }> {
    const types = this.subjectTypeRegistry.getTypes();
    return { types };
  }

  /**
   * Get available values for a specific subject type
   * GET /api/v1/policies/subject-values/:type
   */
  @Get('subject-values/:type')
  @Version('1')
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Get available values for a specific subject type' })
  @ApiResponse({
    status: 200,
    description: 'List of subject values',
    schema: {
      type: 'object',
      properties: {
        values: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'uuid-1' },
              label: { type: 'string', example: 'Admin' },
            },
          },
        },
      },
    },
  })
  async getSubjectValues(
    @Param('type') type: string
  ): Promise<{ values: Array<{ id: string; label: string }> }> {
    const values = await this.subjectTypeRegistry.getValues(type);
    return { values };
  }

  /**
   * Get all available resources from permissions
   * GET /api/v1/policies/resources
   */
  @Get('resources')
  @Version('1')
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Get all available resources for policy assignment' })
  @ApiResponse({
    status: 200,
    description: 'List of resources',
    schema: {
      type: 'object',
      properties: {
        resources: {
          type: 'array',
          items: { type: 'string' },
          example: ['*', 'user', 'role', 'policy', 'permission'],
        },
      },
    },
  })
  async getResources(): Promise<{ resources: string[] }> {
    const result = await this.permissionRepository
      .createQueryBuilder('permission')
      .select('DISTINCT permission.resource', 'resource')
      .getRawMany();

    const resources = result.map((r) => r.resource).sort();
    // Add wildcard '*' option at the beginning
    return { resources: ['*', ...resources] };
  }

  /**
   * Get all available actions from permissions
   * GET /api/v1/policies/actions
   */
  @Get('actions')
  @Version('1')
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Get all available actions for policy assignment' })
  @ApiResponse({
    status: 200,
    description: 'List of actions',
    schema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          items: { type: 'string' },
          example: ['*', 'create', 'read', 'update', 'delete'],
        },
      },
    },
  })
  async getActions(): Promise<{ actions: string[] }> {
    const result = await this.permissionRepository
      .createQueryBuilder('permission')
      .select('DISTINCT permission.action', 'action')
      .getRawMany();

    const actions = result.map((r) => r.action).sort();
    // Add wildcard '*' option at the beginning
    return { actions: ['*', ...actions] };
  }

  /**
   * Bulk check permissions for multiple resources/actions
   * POST /api/v1/policies/check/bulk
   */
  @Post('check/bulk')
  @Version('1')
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Bulk check multiple permissions for current user' })
  @ApiResponse({ status: 200, description: 'Permission check results for all requests' })
  async checkBulkPermissions(
    @CurrentUser() user: User,
    @Body() requests: Array<{ resource: string; action: string }>
  ): Promise<Record<string, boolean>> {
    return this.policyEvaluator.evaluateBulk(user, requests);
  }

  // ==================== Dynamic Routes (:id) ====================

  /**
   * Get a specific policy by ID
   * GET /api/v1/policies/:id
   */
  @Get(':id')
  @Version('1')
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Get ABAC policy by ID' })
  @ApiResponse({ status: 200, description: 'Policy details' })
  async findOne(@Param('id') id: string): Promise<Policy> {
    return this.policyService.findOne(id);
  }

  /**
   * Update a policy
   * PUT /api/v1/policies/:id
   */
  @Put(':id')
  @Version('1')
  @RequirePermission('policy', 'update')
  @ApiOperation({ summary: 'Update an ABAC policy' })
  @ApiResponse({ status: 200, description: 'Policy updated successfully' })
  async update(@Param('id') id: string, @Body() dto: UpdatePolicyDto): Promise<Policy> {
    const policy = await this.policyService.update(id, dto);
    // Invalidate cache when policy is updated
    this.policyEvaluator.invalidateCache();
    return policy;
  }

  /**
   * Delete a policy
   * DELETE /api/v1/policies/:id
   */
  @Delete(':id')
  @Version('1')
  @RequirePermission('policy', 'delete')
  @ApiOperation({ summary: 'Delete an ABAC policy' })
  @ApiResponse({ status: 200, description: 'Policy deleted successfully' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.policyService.remove(id);
    // Invalidate cache when policy is deleted
    this.policyEvaluator.invalidateCache();
    return { message: 'Policy deleted successfully' };
  }
}
