import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PolicyService } from './policy.service';
import { PolicyEvaluatorService } from './policy-evaluator.service';
import { CreatePolicyDto, UpdatePolicyDto, QueryPolicyDto } from './dto';
import { RequirePermission } from './decorators/require-permission.decorator';
import { PermissionGuard } from './guards/permission.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Policy } from '../entities/policy.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

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
    private readonly policyEvaluator: PolicyEvaluatorService
  ) {}

  /**
   * Create a new policy
   * POST /api/policies
   */
  @Post()
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
   * GET /api/policies
   */
  @Get()
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'List all ABAC policies' })
  @ApiResponse({ status: 200, description: 'List of policies with pagination' })
  async findAll(
    @Query() query: QueryPolicyDto
  ): Promise<{ data: Policy[]; total: number; page: number; limit: number }> {
    const { data, total } = await this.policyService.findAll(query);
    return {
      data,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  /**
   * Get a specific policy by ID
   * GET /api/policies/:id
   */
  @Get(':id')
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Get ABAC policy by ID' })
  @ApiResponse({ status: 200, description: 'Policy details' })
  async findOne(@Param('id') id: string): Promise<Policy> {
    return this.policyService.findOne(id);
  }

  /**
   * Update a policy
   * PUT /api/policies/:id
   */
  @Put(':id')
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
   * DELETE /api/policies/:id
   */
  @Delete(':id')
  @RequirePermission('policy', 'delete')
  @ApiOperation({ summary: 'Delete an ABAC policy' })
  @ApiResponse({ status: 200, description: 'Policy deleted successfully' })
  async remove(@Param('id') id: string): Promise<{ message: string }> {
    await this.policyService.remove(id);
    // Invalidate cache when policy is deleted
    this.policyEvaluator.invalidateCache();
    return { message: 'Policy deleted successfully' };
  }

  /**
   * Check current user's permission for a specific resource/action
   * GET /api/policies/check?resource=policy&action=read
   */
  @Get('check/permission')
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
   * Bulk check permissions for multiple resources/actions
   * POST /api/policies/check/bulk
   */
  @Post('check/bulk')
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Bulk check multiple permissions for current user' })
  @ApiResponse({ status: 200, description: 'Permission check results for all requests' })
  async checkBulkPermissions(
    @CurrentUser() user: User,
    @Body() requests: Array<{ resource: string; action: string }>
  ): Promise<Record<string, boolean>> {
    return this.policyEvaluator.evaluateBulk(user, requests);
  }
}
