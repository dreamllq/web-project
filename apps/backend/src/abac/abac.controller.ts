import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AbacService, CoverageResponse, TestPermissionResult } from './abac.service';
import { TestPermissionDto } from './dto/test-permission.dto';
import { RequirePermission } from '../policy/decorators/require-permission.decorator';
import { PermissionGuard } from '../policy/guards/permission.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('abac')
@Controller('abac')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class AbacController {
  /**
   * ABAC Coverage API Endpoints
   *
   * Authorization: All endpoints require ABAC policy evaluation.
   * These endpoints provide insights into ABAC coverage statistics.
   */
  constructor(private readonly abacService: AbacService) {}

  /**
   * Get ABAC coverage statistics
   * GET /api/abac/coverage
   *
   * Returns coverage statistics comparing RBAC permissions with ABAC policies
   */
  @Get('coverage')
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Get ABAC coverage statistics' })
  @ApiResponse({
    status: 200,
    description: 'Coverage statistics',
    schema: {
      example: {
        rbac_count: 17,
        abac_count: 8,
        enabled_abac_count: 8,
        coverage_percent: 100,
        missing_policies: [],
        role_coverage: [
          { role: 'super_admin', policies: 1, permissions: 17 },
          { role: 'user', policies: 2, permissions: 2 },
        ],
      },
    },
  })
  async getCoverage(): Promise<CoverageResponse> {
    return this.abacService.getCoverage();
  }

  /**
   * Test permission evaluation for a user
   * POST /api/abac/test
   */
  @Post('test')
  @RequirePermission('policy', 'read')
  @ApiOperation({ summary: 'Test ABAC permission evaluation for a user' })
  @ApiResponse({
    status: 201,
    description: 'Permission evaluation result with matched policies',
    schema: {
      example: {
        allowed: true,
        user: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          username: 'testuser',
          roles: ['admin'],
        },
        resource: 'user',
        action: 'read',
        matchedPolicies: [
          {
            id: 'policy-1',
            name: 'Admin - User Read',
            effect: 'allow',
            subject: 'role:admin',
            priority: 50,
          },
        ],
        evaluationTimeMs: 12,
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async testPermission(@Body() dto: TestPermissionDto): Promise<TestPermissionResult> {
    return this.abacService.testPermission(dto);
  }
}
