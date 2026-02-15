import { Test, TestingModule } from '@nestjs/testing';
import { InitService } from './init.service';
import { UsersService } from '../users/users.service';
import { PolicyService } from '../policy/policy.service';
import * as bcrypt from 'bcrypt';

// Define enums locally to avoid circular dependency issues with entity imports
enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  PENDING = 'pending',
}

enum PolicyEffect {
  ALLOW = 'allow',
  DENY = 'deny',
}

// Mock all external dependencies
jest.mock('./cli/prompts');
jest.mock('./utils/connection-tester');
jest.mock('./utils/env-writer');
jest.mock('bcrypt');

import { runInitPrompts } from './cli/prompts';
import { testDatabaseConnection, testRedisConnection } from './utils/connection-tester';
import { writeEnvFile } from './utils/env-writer';

const mockedRunInitPrompts = runInitPrompts as jest.MockedFunction<typeof runInitPrompts>;
const mockedTestDatabaseConnection = testDatabaseConnection as jest.MockedFunction<
  typeof testDatabaseConnection
>;
const mockedTestRedisConnection = testRedisConnection as jest.MockedFunction<
  typeof testRedisConnection
>;
const mockedWriteEnvFile = writeEnvFile as jest.MockedFunction<typeof writeEnvFile>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('InitService', () => {
  let service: InitService;
  let usersService: jest.Mocked<UsersService>;
  let policyService: jest.Mocked<PolicyService>;

  const mockConfig = {
    database: {
      type: 'local' as const,
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'postgres123',
      database: 'app',
    },
    redis: {
      type: 'local' as const,
      host: 'localhost',
      port: 6379,
      password: '',
      db: 0,
    },
    admin: {
      username: 'admin',
      password: 'Admin123!',
    },
  };

  const mockUser = {
    id: 'user-uuid-123',
    username: 'admin',
    passwordHash: 'hashed-password',
    email: null,
    phone: null,
    nickname: null,
    avatarUrl: null,
    status: UserStatus.PENDING,
    locale: 'zh-CN',
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
  };

  const mockPolicy = {
    id: 'policy-uuid-456',
    name: 'Super Admin Policy',
    description: 'Full access policy for super administrator',
    subject: 'user:user-uuid-123',
    resource: '*',
    action: '*',
    effect: PolicyEffect.ALLOW,
    priority: 1000,
    enabled: true,
    conditions: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    policyAttributes: [],
  };

  beforeEach(async () => {
    // Create mock services
    usersService = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      findByPhone: jest.fn(),
      updateLastLogin: jest.fn(),
      updateStatus: jest.fn(),
      createOAuthUser: jest.fn(),
      findSocialAccount: jest.fn(),
      createSocialAccount: jest.fn(),
      generateOAuthUsername: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    policyService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      getEnabledPolicies: jest.fn(),
      findBySubject: jest.fn(),
      hasPolicyForResource: jest.fn(),
    } as unknown as jest.Mocked<PolicyService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InitService,
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: PolicyService,
          useValue: policyService,
        },
      ],
    }).compile();

    service = module.get<InitService>(InitService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should be injectable', () => {
      expect(service).toBeInstanceOf(InitService);
    });
  });

  describe('runInitialization', () => {
    let processExitSpy: jest.SpyInstance;

    beforeEach(() => {
      // Setup default mock implementations
      mockedRunInitPrompts.mockResolvedValue(mockConfig);
      mockedTestDatabaseConnection.mockResolvedValue(true);
      mockedTestRedisConnection.mockResolvedValue(true);
      mockedWriteEnvFile.mockImplementation(() => {});
      mockedBcrypt.hash.mockResolvedValue('hashed-password' as never);
      usersService.create.mockResolvedValue(mockUser);
      usersService.updateStatus.mockResolvedValue(undefined);
      policyService.create.mockResolvedValue(mockPolicy as any);

      // Mock process.exit to prevent test from exiting
      processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    });

    afterEach(() => {
      processExitSpy.mockRestore();
    });

    it('should run the complete initialization flow', async () => {
      await service.runInitialization();

      // Verify CLI prompts were called
      expect(mockedRunInitPrompts).toHaveBeenCalledTimes(1);

      // Verify database connection test
      expect(mockedTestDatabaseConnection).toHaveBeenCalledWith(mockConfig.database);

      // Verify Redis connection test
      expect(mockedTestRedisConnection).toHaveBeenCalledWith(mockConfig.redis);

      // Verify env file was written
      expect(mockedWriteEnvFile).toHaveBeenCalledWith(mockConfig);

      // Verify user was created
      expect(usersService.create).toHaveBeenCalledWith({
        username: mockConfig.admin.username,
        passwordHash: 'hashed-password',
      });

      // Verify user status was updated to ACTIVE
      expect(usersService.updateStatus).toHaveBeenCalledWith(mockUser.id, UserStatus.ACTIVE);

      // Verify policy was created with correct parameters
      expect(policyService.create).toHaveBeenCalledWith({
        name: 'Super Admin Policy',
        description: 'Full access policy for super administrator',
        subject: `user:${mockUser.id}`,
        resource: '*',
        action: '*',
        effect: PolicyEffect.ALLOW,
        priority: 1000,
        enabled: true,
      });

      // Verify process.exit was called with 0
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it('should hash the admin password using bcrypt', async () => {
      await service.runInitialization();

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(mockConfig.admin.password, 10);
    });

    it('should throw error if database connection fails', async () => {
      const dbError = new Error('Database connection failed');
      mockedTestDatabaseConnection.mockRejectedValue(dbError);

      await expect(service.runInitialization()).rejects.toThrow('Database connection failed');

      expect(mockedTestRedisConnection).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should throw error if Redis connection fails', async () => {
      const redisError = new Error('Redis connection failed');
      mockedTestRedisConnection.mockRejectedValue(redisError);

      await expect(service.runInitialization()).rejects.toThrow('Redis connection failed');

      expect(mockedTestDatabaseConnection).toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('should throw error if user creation fails', async () => {
      const userError = new Error('Username already exists');
      usersService.create.mockRejectedValue(userError);

      await expect(service.runInitialization()).rejects.toThrow('Username already exists');

      expect(policyService.create).not.toHaveBeenCalled();
    });

    it('should throw error if policy creation fails', async () => {
      const policyError = new Error('Policy creation failed');
      policyService.create.mockRejectedValue(policyError);

      await expect(service.runInitialization()).rejects.toThrow('Policy creation failed');
    });

    it('should create policy with subject in format user:{userId}', async () => {
      await service.runInitialization();

      const createCall = policyService.create.mock.calls[0][0];
      expect(createCall.subject).toBe(`user:${mockUser.id}`);
    });

    it('should create policy with priority 1000', async () => {
      await service.runInitialization();

      const createCall = policyService.create.mock.calls[0][0];
      expect(createCall.priority).toBe(1000);
    });

    it('should create policy with effect ALLOW', async () => {
      await service.runInitialization();

      const createCall = policyService.create.mock.calls[0][0];
      expect(createCall.effect).toBe(PolicyEffect.ALLOW);
    });

    it('should create enabled policy', async () => {
      await service.runInitialization();

      const createCall = policyService.create.mock.calls[0][0];
      expect(createCall.enabled).toBe(true);
    });
  });
});
