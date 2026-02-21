import { Test, TestingModule } from '@nestjs/testing';
import { AbacController } from './abac.controller';
import { AbacService, CoverageResponse, TestPermissionResult } from './abac.service';
import { TestPermissionDto } from './dto/test-permission.dto';

describe('AbacController', () => {
  let controller: AbacController;

  const mockCoverageResponse: CoverageResponse = {
    rbac_count: 17,
    abac_count: 8,
    enabled_abac_count: 8,
    coverage_percent: 100,
    missing_policies: [],
    role_coverage: [
      { role: 'super_admin', policies: 1, permissions: 17 },
      { role: 'user', policies: 2, permissions: 2 },
    ],
  };

  const mockAbacService = {
    getCoverage: jest.fn(),
    testPermission: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AbacController],
      providers: [
        {
          provide: AbacService,
          useValue: mockAbacService,
        },
      ],
    }).compile();

    controller = module.get<AbacController>(AbacController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCoverage', () => {
    it('should return coverage statistics', async () => {
      mockAbacService.getCoverage.mockResolvedValue(mockCoverageResponse);

      const result = await controller.getCoverage();

      expect(result).toEqual(mockCoverageResponse);
      expect(mockAbacService.getCoverage).toHaveBeenCalled();
    });

    it('should return coverage with missing policies', async () => {
      const responseWithGaps: CoverageResponse = {
        rbac_count: 17,
        abac_count: 6,
        enabled_abac_count: 6,
        coverage_percent: 88.2,
        missing_policies: [
          { resource: 'user', action: 'delete', permission_name: 'user:delete' },
          { resource: 'file', action: 'share', permission_name: 'file:share' },
        ],
        role_coverage: [{ role: 'admin', policies: 1, permissions: 10 }],
      };

      mockAbacService.getCoverage.mockResolvedValue(responseWithGaps);

      const result = await controller.getCoverage();

      expect(result).toEqual(responseWithGaps);
      expect(result.missing_policies).toHaveLength(2);
      expect(result.coverage_percent).toBe(88.2);
    });

    it('should handle empty database', async () => {
      const emptyResponse: CoverageResponse = {
        rbac_count: 0,
        abac_count: 0,
        enabled_abac_count: 0,
        coverage_percent: 0,
        missing_policies: [],
        role_coverage: [],
      };

      mockAbacService.getCoverage.mockResolvedValue(emptyResponse);

      const result = await controller.getCoverage();

      expect(result).toEqual(emptyResponse);
      expect(result.rbac_count).toBe(0);
      expect(result.abac_count).toBe(0);
    });
  });

  describe('testPermission', () => {
    const mockTestPermissionResult: TestPermissionResult = {
      allowed: true,
      user: {
        id: 'user-1',
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
    };

    it('should return permission evaluation result', async () => {
      mockAbacService.testPermission.mockResolvedValue(mockTestPermissionResult);

      const dto: TestPermissionDto = {
        userId: 'user-1',
        resource: 'user',
        action: 'read',
      };

      const result = await controller.testPermission(dto);

      expect(result).toEqual(mockTestPermissionResult);
      expect(mockAbacService.testPermission).toHaveBeenCalledWith(dto);
    });

    it('should return denied result when access is not allowed', async () => {
      const deniedResult: TestPermissionResult = {
        allowed: false,
        user: {
          id: 'user-2',
          username: 'regularuser',
          roles: ['user'],
        },
        resource: 'user',
        action: 'delete',
        matchedPolicies: [],
        evaluationTimeMs: 5,
      };

      mockAbacService.testPermission.mockResolvedValue(deniedResult);

      const dto: TestPermissionDto = {
        userId: 'user-2',
        resource: 'user',
        action: 'delete',
      };

      const result = await controller.testPermission(dto);

      expect(result.allowed).toBe(false);
      expect(result.matchedPolicies).toHaveLength(0);
    });
  });
});
