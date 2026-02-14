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
} from '@nestjs/common';
import { PolicyService } from './policy.service';
import { PolicyEvaluatorService } from './policy-evaluator.service';
import { CreatePolicyDto, UpdatePolicyDto, QueryPolicyDto } from './dto';
import { RequirePermission } from './decorators/require-permission.decorator';
import { PermissionGuard } from './guards/permission.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Policy } from '../entities/policy.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

@Controller('policies')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PolicyController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly policyEvaluator: PolicyEvaluatorService,
  ) {}

  /**
   * Create a new policy
   * POST /api/policies
   */
  @Post()
  @RequirePermission('policy', 'create')
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
  async findAll(
    @Query() query: QueryPolicyDto,
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
  async findOne(@Param('id') id: string): Promise<Policy> {
    return this.policyService.findOne(id);
  }

  /**
   * Update a policy
   * PUT /api/policies/:id
   */
  @Put(':id')
  @RequirePermission('policy', 'update')
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
  async checkPermission(
    @CurrentUser() user: User,
    @Query('resource') resource: string,
    @Query('action') action: string,
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
  async checkBulkPermissions(
    @CurrentUser() user: User,
    @Body() requests: Array<{ resource: string; action: string }>,
  ): Promise<Record<string, boolean>> {
    return this.policyEvaluator.evaluateBulk(user, requests);
  }
}
