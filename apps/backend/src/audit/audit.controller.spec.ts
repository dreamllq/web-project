import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditLog } from '../entities/audit-log.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../policy/guards/permission.guard';

describe('AuditController', () => {
  let controller: AuditController;

  const mockAuditLog: AuditLog = {
    id: 'audit-uuid-123',
    userId: 'user-uuid-123',
    action: 'create',
    resourceType: 'user',
    resourceId: 'resource-uuid',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    requestData: { name: 'test' },
    responseStatus: 201,
    errorMessage: null,
    createdAt: new Date(),
    user: null,
  };

  const mockAuditService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByUserId: jest.fn(),
    findByResource: jest.fn(),
  };

  // Mock guards to bypass authentication/authorization in tests
  const mockJwtAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };
  const mockPermissionGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockJwtAuthGuard)
      .overrideGuard(PermissionGuard)
      .useValue(mockPermissionGuard)
      .compile();

    controller = module.get<AuditController>(AuditController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const query = { page: 1, limit: 10 };
      mockAuditService.findAll.mockResolvedValue({
        data: [mockAuditLog],
        total: 1,
      });

      const result = await controller.findAll(query);

      expect(result).toEqual({
        data: [mockAuditLog],
        total: 1,
        page: 1,
        limit: 10,
      });
      expect(mockAuditService.findAll).toHaveBeenCalledWith(query);
    });

    it('should use default pagination values', async () => {
      mockAuditService.findAll.mockResolvedValue({
        data: [],
        total: 0,
      });

      const result = await controller.findAll({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should pass filter parameters correctly', async () => {
      mockAuditService.findAll.mockResolvedValue({
        data: [mockAuditLog],
        total: 1,
      });

      const query = {
        userId: 'user-uuid-123',
        action: 'create',
        resourceType: 'user',
      };

      await controller.findAll(query);

      expect(mockAuditService.findAll).toHaveBeenCalledWith(query);
    });

    it('should pass date range parameters', async () => {
      mockAuditService.findAll.mockResolvedValue({
        data: [mockAuditLog],
        total: 1,
      });

      const query = {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
      };

      await controller.findAll(query);

      expect(mockAuditService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return an audit log by ID', async () => {
      mockAuditService.findOne.mockResolvedValue(mockAuditLog);

      const result = await controller.findOne('audit-uuid-123');

      expect(result).toEqual(mockAuditLog);
      expect(mockAuditService.findOne).toHaveBeenCalledWith('audit-uuid-123');
    });

    it('should propagate NotFoundException from service', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockAuditService.findOne.mockRejectedValue(new NotFoundException('Not found'));

      await expect(controller.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});
