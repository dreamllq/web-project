import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { User, UserStatus } from '../entities/user.entity';
import { UsersService, CreateUserData } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserData: CreateUserData = {
      username: 'testuser',
      passwordHash: 'hashedpassword',
      email: 'test@example.com',
    };

    it('should create a new user successfully', async () => {
      const mockUser = {
        id: 'uuid-123',
        username: 'testuser',
        passwordHash: 'hashedpassword',
        email: 'test@example.com',
        status: UserStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(null);
      mockRepository.create.mockReturnValue(mockUser);
      mockRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(createUserData);

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledTimes(2);
      expect(mockRepository.create).toHaveBeenCalledWith({
        username: 'testuser',
        passwordHash: 'hashedpassword',
        email: 'test@example.com',
        phone: null,
        status: UserStatus.PENDING,
      });
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if username already exists', async () => {
      mockRepository.findOne.mockResolvedValueOnce({ id: 'existing-id' });

      await expect(service.create(createUserData)).rejects.toThrow(ConflictException);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { username: 'testuser' } });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockRepository.findOne
        .mockResolvedValueOnce(null) // username check
        .mockResolvedValueOnce({ id: 'existing-id' }); // email check

      await expect(service.create(createUserData)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if phone already exists', async () => {
      const dataWithPhone: CreateUserData = {
        ...createUserData,
        phone: '1234567890',
      };

      mockRepository.findOne
        .mockResolvedValueOnce(null) // username check
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: 'existing-id' }); // phone check

      await expect(service.create(dataWithPhone)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return a user by id', async () => {
      const mockUser = { id: 'uuid-123', username: 'testuser' };
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('uuid-123');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 'uuid-123' } });
    });

    it('should return null if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByUsername', () => {
    it('should return a user by username', async () => {
      const mockUser = { id: 'uuid-123', username: 'testuser' };
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByUsername('testuser');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { username: 'testuser' } });
    });

    it('should return null if user not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findByUsername('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should return a user by email', async () => {
      const mockUser = { id: 'uuid-123', email: 'test@example.com' };
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    });
  });

  describe('findByPhone', () => {
    it('should return a user by phone', async () => {
      const mockUser = { id: 'uuid-123', phone: '1234567890' };
      mockRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByPhone('1234567890');

      expect(result).toEqual(mockUser);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { phone: '1234567890' } });
    });
  });

  describe('updateLastLogin', () => {
    it('should update last login timestamp and IP', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateLastLogin('uuid-123', '192.168.1.1');

      expect(mockRepository.update).toHaveBeenCalledWith(
        'uuid-123',
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
          lastLoginIp: '192.168.1.1',
        }),
      );
    });

    it('should update last login without IP', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateLastLogin('uuid-123');

      expect(mockRepository.update).toHaveBeenCalledWith(
        'uuid-123',
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
          lastLoginIp: null,
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('should update user status', async () => {
      mockRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('uuid-123', UserStatus.ACTIVE);

      expect(mockRepository.update).toHaveBeenCalledWith('uuid-123', { status: UserStatus.ACTIVE });
    });
  });
});
