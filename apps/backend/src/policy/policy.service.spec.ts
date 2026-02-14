import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PolicyService } from './policy.service';
import { Policy, PolicyEffect } from '../entities/policy.entity';
import { CreatePolicyDto, UpdatePolicyDto } from './dto';

describe('PolicyService', () => {
  let service: PolicyService;

  const mockPolicy: Policy = {
    id: 'uuid-123',
    name: 'Test Policy',
    description: 'Test policy description',
    effect: PolicyEffect.ALLOW,
    subject: 'role:admin',
    resource: 'user:*',
    action: '*',
    conditions: null,
    priority: 100,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    policyAttributes: [],
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PolicyService,
        {
          provide: getRepositoryToken(Policy),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PolicyService>(PolicyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreatePolicyDto = {
      name: 'New Policy',
      effect: PolicyEffect.ALLOW,
      subject: 'role:user',
      resource: 'file',
      action: 'read',
    };

    it('should create a new policy successfully', async () => {
      mockRepository.create.mockReturnValue(mockPolicy);
      mockRepository.save.mockResolvedValue(mockPolicy);

      const result = await service.create(createDto);

      expect(result).toEqual(mockPolicy);
      expect(mockRepository.create).toHaveBeenCalledWith({
        name: createDto.name,
        description: null,
        effect: createDto.effect,
        subject: createDto.subject,
        resource: createDto.resource,
        action: createDto.action,
        conditions: null,
        priority: 0,
        enabled: true,
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should create policy with all optional fields', async () => {
      const fullDto: CreatePolicyDto = {
        name: 'Full Policy',
        description: 'Full description',
        effect: PolicyEffect.DENY,
        subject: 'department:hr',
        resource: 'salary:*',
        action: 'read,write',
        conditions: { time: { after: '09:00', before: '18:00' } },
        priority: 50,
        enabled: false,
      };

      const expectedPolicy = { ...mockPolicy, ...fullDto };
      mockRepository.create.mockReturnValue(expectedPolicy);
      mockRepository.save.mockResolvedValue(expectedPolicy);

      const result = await service.create(fullDto);

      expect(result).toEqual(expectedPolicy);
      expect(mockRepository.create).toHaveBeenCalledWith({
        name: fullDto.name,
        description: fullDto.description,
        effect: fullDto.effect,
        subject: fullDto.subject,
        resource: fullDto.resource,
        action: fullDto.action,
        conditions: fullDto.conditions,
        priority: fullDto.priority,
        enabled: fullDto.enabled,
      });
    });
  });

  describe('findAll', () => {
    it('should return paginated policies', async () => {
      const policies = [mockPolicy];
      mockRepository.findAndCount.mockResolvedValue([policies, 1]);

      const result = await service.findAll({});

      expect(result).toEqual({ data: policies, total: 1 });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { priority: 'DESC', createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter by name', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockPolicy], 1]);

      await service.findAll({ name: 'Test' });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: expect.any(Object) },
        }),
      );
    });

    it('should filter by enabled status', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockPolicy], 1]);

      await service.findAll({ enabled: true });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { enabled: true },
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockPolicy], 50]);

      const result = await service.findAll({ page: 2, limit: 10 });

      expect(result).toEqual({ data: [mockPolicy], total: 50 });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: {},
        order: { priority: 'DESC', createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
    });
  });

  describe('findOne', () => {
    it('should return a policy by ID', async () => {
      mockRepository.findOne.mockResolvedValue(mockPolicy);

      const result = await service.findOne('uuid-123');

      expect(result).toEqual(mockPolicy);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-123' } });
    });

    it('should throw NotFoundException if policy not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update policy fields', async () => {
      const updateDto: UpdatePolicyDto = {
        name: 'Updated Policy',
        priority: 200,
      };

      mockRepository.findOne.mockResolvedValue(mockPolicy);
      mockRepository.save.mockResolvedValue({ ...mockPolicy, ...updateDto });

      const result = await service.update('uuid-123', updateDto);

      expect(result.name).toBe('Updated Policy');
      expect(result.priority).toBe(200);
    });

    it('should throw NotFoundException if policy not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('non-existent', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove a policy', async () => {
      mockRepository.findOne.mockResolvedValue(mockPolicy);
      mockRepository.remove.mockResolvedValue(mockPolicy);

      await service.remove('uuid-123');

      expect(mockRepository.remove).toHaveBeenCalledWith(mockPolicy);
    });

    it('should throw NotFoundException if policy not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEnabledPolicies', () => {
    it('should return all enabled policies ordered by priority', async () => {
      const policies = [
        { ...mockPolicy, priority: 100 },
        { ...mockPolicy, id: 'uuid-456', priority: 50 },
      ];
      mockRepository.find.mockResolvedValue(policies);

      const result = await service.getEnabledPolicies();

      expect(result).toEqual(policies);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { enabled: true },
        order: { priority: 'DESC', createdAt: 'ASC' },
      });
    });
  });

  describe('findBySubject', () => {
    it('should find policies by subject pattern', async () => {
      mockRepository.find.mockResolvedValue([mockPolicy]);

      const result = await service.findBySubject('admin');

      expect(result).toEqual([mockPolicy]);
      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { subject: expect.any(Object), enabled: true },
        order: { priority: 'DESC' },
      });
    });
  });

  describe('hasPolicyForResource', () => {
    it('should return true if policy exists for resource/action', async () => {
      mockRepository.count.mockResolvedValue(1);

      const result = await service.hasPolicyForResource('user', 'read');

      expect(result).toBe(true);
    });

    it('should return false if no policy exists', async () => {
      mockRepository.count.mockResolvedValue(0);

      const result = await service.hasPolicyForResource('nonexistent', 'action');

      expect(result).toBe(false);
    });
  });
});
