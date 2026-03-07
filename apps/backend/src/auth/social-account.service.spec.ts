import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { SocialAccountService } from './social-account.service';
import { SocialAccount, SocialAccountStatus } from '../entities/social-account.entity';
import { SocialProvider } from '../entities/social-provider.enum';

describe('SocialAccountService', () => {
  let service: SocialAccountService;
  let mockRepository: any;

  const mockSocialAccount: SocialAccount = {
    id: 'test-id',
    userId: 'user-id',
    provider: SocialProvider.WECHAT,
    providerUserId: 'wx_123',
    providerData: { openid: 'wx_123' },
    accessToken: 'access_token',
    refreshToken: 'refresh_token',
    tokenExpiresAt: new Date(Date.now() + 3600000),
    status: SocialAccountStatus.LINKED,
    unboundAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: null as any,
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: mock().mockResolvedValue(mockSocialAccount),
      find: mock().mockResolvedValue([mockSocialAccount]),
      update: mock().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SocialAccountService,
        {
          provide: getRepositoryToken(SocialAccount),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SocialAccountService>(SocialAccountService);
  });

  afterEach(() => {
    mockRepository.findOne.mockClear();
    mockRepository.find.mockClear();
  });

  it('should find by id', async () => {
    const result = await service.findById('test-id');

    expect(result).toEqual(mockSocialAccount);
  });

  it('should find by user', async () => {
    const result = await service.findByUser('user-id');

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockSocialAccount);
  });

  it('should find by provider', async () => {
    const result = await service.findByProvider(SocialProvider.WECHAT, 'wx_123');

    expect(result).toEqual(mockSocialAccount);
  });

  it('should unlink social account', async () => {
    await service.unlink('test-id');

    expect(mockRepository.update).toHaveBeenCalledWith('test-id', {
      status: SocialAccountStatus.UNLINKED,
      unboundAt: expect.any(Date),
      accessToken: null,
      refreshToken: null,
    });
  });

  it('should throw when unlinking already unlinked account', async () => {
    const unlinkedAccount = { ...mockSocialAccount, status: SocialAccountStatus.UNLINKED };
    mockRepository.findOne.mockResolvedValueOnce(unlinkedAccount);

    await expect(service.unlink('test-id')).rejects.toThrow('Social account already unlinked');
  });

  it('should update tokens', async () => {
    await service.updateTokens(
      'test-id',
      'new_access_token',
      'new_refresh_token',
      new Date(Date.now() + 7200000)
    );

    expect(mockRepository.update).toHaveBeenCalled();
  });
});
