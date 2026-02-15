import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { Test, TestingModule } from '@nestjs/testing';
import { Injectable } from '@nestjs/common';

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

// Mock class placeholders
class MockUser {}
class MockPolicy {}

// Create mock service classes that will be used for DI
@Injectable()
class MockUsersService {
  create = mock(async () => ({}));
  findById = mock(async () => null);
  findByUsername = mock(async () => null);
  findByEmail = mock(async () => null);
  findByPhone = mock(async () => null);
  updateLastLogin = mock(async () => {});
  updateStatus = mock(async () => {});
  createOAuthUser = mock(async () => ({}));
  findSocialAccount = mock(async () => null);
  createSocialAccount = mock(async () => ({}));
  generateOAuthUsername = mock(async () => '');
}

@Injectable()
class MockPolicyService {
  create = mock(async () => ({}));
  findAll = mock(async () => []);
  findOne = mock(async () => null);
  update = mock(async () => ({}));
  remove = mock(async () => {});
  getEnabledPolicies = mock(async () => []);
  findBySubject = mock(async () => []);
  hasPolicyForResource = mock(async () => false);
}

// Mock entities BEFORE any imports that use them - include all exports
mock.module('../entities/user.entity', () => ({
  UserStatus: {
    ACTIVE: 'active',
    DISABLED: 'disabled',
    PENDING: 'pending',
  },
  User: MockUser,
}));

mock.module('../entities/policy.entity', () => ({
  PolicyEffect: {
    ALLOW: 'allow',
    DENY: 'deny',
  },
  Policy: MockPolicy,
}));

// Mock services BEFORE any imports that use them
mock.module('../users/users.service', () => ({
  UsersService: MockUsersService,
}));

mock.module('../policy/policy.service', () => ({
  PolicyService: MockPolicyService,
}));

// Also mock other entities that might have circular deps with User
mock.module('../entities/social-account.entity', () => ({
  SocialAccount: class MockSocialAccount {},
}));

mock.module('../entities/notification.entity', () => ({
  Notification: class MockNotification {},
}));

mock.module('../entities/file.entity', () => ({
  File: class MockFile {},
}));

mock.module('../entities/oauth-token.entity', () => ({
  OAuthToken: class MockOAuthToken {},
}));

mock.module('../entities/policy-attribute.entity', () => ({
  PolicyAttribute: class MockPolicyAttribute {},
}));

describe('InitService', () => {
  let service: any;
  let mockUsersServiceInstance: MockUsersService;
  let mockPolicyServiceInstance: MockPolicyService;

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

  // Mock functions that will be configured
  let mockRunInitPrompts: ReturnType<typeof mock>;
  let mockTestDatabaseConnection: ReturnType<typeof mock>;
  let mockTestRedisConnection: ReturnType<typeof mock>;
  let mockWriteEnvFile: ReturnType<typeof mock>;
  let mockBcryptHash: ReturnType<typeof mock>;
  let originalProcessExit: (code: number) => never;

  beforeEach(async () => {
    // Create fresh mock functions for each test
    mockRunInitPrompts = mock(async () => mockConfig);
    mockTestDatabaseConnection = mock(async () => true);
    mockTestRedisConnection = mock(async () => true);
    mockWriteEnvFile = mock(() => {});
    mockBcryptHash = mock(async () => 'hashed-password');

    // Setup module mocks
    mock.module('./cli/prompts', () => ({
      runInitPrompts: mockRunInitPrompts,
    }));

    mock.module('./utils/connection-tester', () => ({
      testDatabaseConnection: mockTestDatabaseConnection,
      testRedisConnection: mockTestRedisConnection,
    }));

    mock.module('./utils/env-writer', () => ({
      writeEnvFile: mockWriteEnvFile,
    }));

    mock.module('bcrypt', () => ({
      hash: mockBcryptHash,
    }));

    // Create mock service instances
    mockUsersServiceInstance = new MockUsersService();
    mockPolicyServiceInstance = new MockPolicyService();

    // Set up mock implementations
    mockUsersServiceInstance.create.mockImplementation(async () => mockUser);
    mockUsersServiceInstance.updateStatus.mockImplementation(async () => {});
    mockPolicyServiceInstance.create.mockImplementation(async () => mockPolicy);

    // Save original process.exit
    originalProcessExit = process.exit;

    // Clear module cache for init.service
    const modulePath = require.resolve('./init.service');
    delete require.cache[modulePath];

    // Import InitService after mocks are set up
    const { InitService } = await import('./init.service');
    const { UsersService } = await import('../users/users.service');
    const { PolicyService } = await import('../policy/policy.service');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InitService,
        {
          provide: UsersService,
          useValue: mockUsersServiceInstance,
        },
        {
          provide: PolicyService,
          useValue: mockPolicyServiceInstance,
        },
      ],
    }).compile();

    service = module.get(InitService);
  });

  afterEach(() => {
    // Restore process.exit
    process.exit = originalProcessExit;

    // Clear module cache
    const modulePath = require.resolve('./init.service');
    delete require.cache[modulePath];
  });

  describe('initialization', () => {
    test('should be defined', () => {
      expect(service).toBeDefined();
    });

    test('should be injectable', () => {
      expect(service).toBeInstanceOf(Object);
    });
  });

  describe('runInitialization', () => {
    let processExitMock: ReturnType<typeof mock>;

    beforeEach(() => {
      // Reset mock implementations to defaults
      mockRunInitPrompts.mockImplementation(async () => mockConfig);
      mockTestDatabaseConnection.mockImplementation(async () => true);
      mockTestRedisConnection.mockImplementation(async () => true);
      mockWriteEnvFile.mockImplementation(() => {});
      mockBcryptHash.mockImplementation(async () => 'hashed-password');
      mockUsersServiceInstance.create.mockImplementation(async () => mockUser);
      mockUsersServiceInstance.updateStatus.mockImplementation(async () => {});
      mockPolicyServiceInstance.create.mockImplementation(async () => mockPolicy);

      // Mock process.exit to prevent test from exiting
      processExitMock = mock((code: number) => {
        throw new Error(`process.exit called with code ${code}`);
      });
      process.exit = processExitMock as unknown as typeof process.exit;
    });

    afterEach(() => {
      process.exit = originalProcessExit;
    });

    test('should run the complete initialization flow', async () => {
      // Make process.exit not throw for this test
      processExitMock = mock(() => {});
      process.exit = processExitMock as unknown as typeof process.exit;

      await service.runInitialization();

      // Verify CLI prompts were called
      expect(mockRunInitPrompts).toHaveBeenCalledTimes(1);

      // Verify database connection test
      expect(mockTestDatabaseConnection).toHaveBeenCalledWith(mockConfig.database);

      // Verify Redis connection test
      expect(mockTestRedisConnection).toHaveBeenCalledWith(mockConfig.redis);

      // Verify env file was written
      expect(mockWriteEnvFile).toHaveBeenCalledWith(mockConfig);

      // Verify user was created
      expect(mockUsersServiceInstance.create).toHaveBeenCalledWith({
        username: mockConfig.admin.username,
        passwordHash: 'hashed-password',
      });

      // Verify user status was updated to ACTIVE
      expect(mockUsersServiceInstance.updateStatus).toHaveBeenCalledWith(
        mockUser.id,
        UserStatus.ACTIVE
      );

      // Verify policy was created with correct parameters
      expect(mockPolicyServiceInstance.create).toHaveBeenCalledWith({
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
      expect(processExitMock).toHaveBeenCalledWith(0);
    });

    test('should hash the admin password using bcrypt', async () => {
      // Make process.exit not throw for this test
      processExitMock = mock(() => {});
      process.exit = processExitMock as unknown as typeof process.exit;

      await service.runInitialization();

      expect(mockBcryptHash).toHaveBeenCalledWith(mockConfig.admin.password, 10);
    });

    test('should throw error if database connection fails', async () => {
      const dbError = new Error('Database connection failed');
      mockTestDatabaseConnection.mockImplementation(async () => {
        throw dbError;
      });

      await expect(service.runInitialization()).rejects.toThrow('Database connection failed');

      expect(mockTestRedisConnection).not.toHaveBeenCalled();
      expect(mockUsersServiceInstance.create).not.toHaveBeenCalled();
    });

    test('should throw error if Redis connection fails', async () => {
      const redisError = new Error('Redis connection failed');
      mockTestRedisConnection.mockImplementation(async () => {
        throw redisError;
      });

      await expect(service.runInitialization()).rejects.toThrow('Redis connection failed');

      expect(mockTestDatabaseConnection).toHaveBeenCalled();
      expect(mockUsersServiceInstance.create).not.toHaveBeenCalled();
    });

    test('should throw error if user creation fails', async () => {
      const userError = new Error('Username already exists');
      mockUsersServiceInstance.create.mockImplementation(async () => {
        throw userError;
      });

      await expect(service.runInitialization()).rejects.toThrow('Username already exists');

      expect(mockPolicyServiceInstance.create).not.toHaveBeenCalled();
    });

    test('should throw error if policy creation fails', async () => {
      const policyError = new Error('Policy creation failed');
      mockPolicyServiceInstance.create.mockImplementation(async () => {
        throw policyError;
      });

      await expect(service.runInitialization()).rejects.toThrow('Policy creation failed');
    });

    test('should create policy with subject in format user:{userId}', async () => {
      // Make process.exit not throw for this test
      processExitMock = mock(() => {});
      process.exit = processExitMock as unknown as typeof process.exit;

      await service.runInitialization();

      const calls = mockPolicyServiceInstance.create.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const createCall = calls[0][0];
      expect(createCall.subject).toBe(`user:${mockUser.id}`);
    });

    test('should create policy with priority 1000', async () => {
      // Make process.exit not throw for this test
      processExitMock = mock(() => {});
      process.exit = processExitMock as unknown as typeof process.exit;

      await service.runInitialization();

      const calls = mockPolicyServiceInstance.create.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const createCall = calls[0][0];
      expect(createCall.priority).toBe(1000);
    });

    test('should create policy with effect ALLOW', async () => {
      // Make process.exit not throw for this test
      processExitMock = mock(() => {});
      process.exit = processExitMock as unknown as typeof process.exit;

      await service.runInitialization();

      const calls = mockPolicyServiceInstance.create.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const createCall = calls[0][0];
      expect(createCall.effect).toBe(PolicyEffect.ALLOW);
    });

    test('should create enabled policy', async () => {
      // Make process.exit not throw for this test
      processExitMock = mock(() => {});
      process.exit = processExitMock as unknown as typeof process.exit;

      await service.runInitialization();

      const calls = mockPolicyServiceInstance.create.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const createCall = calls[0][0];
      expect(createCall.enabled).toBe(true);
    });
  });
});
