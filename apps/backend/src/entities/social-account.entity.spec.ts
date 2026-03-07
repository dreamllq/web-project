import { describe, it, expect } from 'bun:test';
import { SocialProvider, SocialAccountStatus } from './social-provider.enum';
import { SocialAccount } from './social-account.entity';

describe('SocialProvider Enum', () => {
  it('should have all 8 provider values', () => {
    const expectedProviders = [
      'wechat',
      'wechat_miniprogram',
      'dingtalk_miniprogram',
      'dingtalk',
      'feishu',
      'douyin',
      'qq',
      'baidu',
    ];

    const actualProviders = Object.values(SocialProvider);

    expect(actualProviders).toHaveLength(8);
    expect(actualProviders).toEqual(expectedProviders);
  });

  it('should have WECHAT provider', () => {
    expect(SocialProvider.WECHAT).toBe('wechat');
  });

  it('should have WECHAT_MINIPROGRAM provider', () => {
    expect(SocialProvider.WECHAT_MINIPROGRAM).toBe('wechat_miniprogram');
  });

  it('should have DINGTALK_MINIPROGRAM provider', () => {
    expect(SocialProvider.DINGTALK_MINIPROGRAM).toBe('dingtalk_miniprogram');
  });

  it('should have DINGTALK provider (for scan login)', () => {
    expect(SocialProvider.DINGTALK).toBe('dingtalk');
  });

  it('should have FEISHU provider', () => {
    expect(SocialProvider.FEISHU).toBe('feishu');
  });

  it('should have DOUYIN provider', () => {
    expect(SocialProvider.DOUYIN).toBe('douyin');
  });

  it('should have QQ provider', () => {
    expect(SocialProvider.QQ).toBe('qq');
  });

  it('should have BAIDU provider', () => {
    expect(SocialProvider.BAIDU).toBe('baidu');
  });
});

describe('SocialAccountStatus Enum', () => {
  it('should have LINKED status', () => {
    expect(SocialAccountStatus.LINKED).toBe('linked');
  });

  it('should have UNLINKED status', () => {
    expect(SocialAccountStatus.UNLINKED).toBe('unlinked');
  });

  it('should have exactly 2 status values', () => {
    const statuses = Object.values(SocialAccountStatus);
    expect(statuses).toHaveLength(2);
  });
});

describe('SocialAccount Entity', () => {
  it('should create entity with all fields', () => {
    const account = new SocialAccount();
    account.userId = 'user-uuid';
    account.provider = SocialProvider.WECHAT;
    account.providerUserId = 'openid-123';
    account.accessToken = 'access-token';
    account.refreshToken = 'refresh-token';
    account.tokenExpiresAt = new Date();
    account.status = SocialAccountStatus.LINKED;
    account.providerData = { nickname: 'test' };

    expect(account.userId).toBe('user-uuid');
    expect(account.provider).toBe(SocialProvider.WECHAT);
    expect(account.providerUserId).toBe('openid-123');
    expect(account.accessToken).toBe('access-token');
    expect(account.refreshToken).toBe('refresh-token');
    expect(account.tokenExpiresAt).toBeInstanceOf(Date);
    expect(account.status).toBe(SocialAccountStatus.LINKED);
    expect(account.providerData).toEqual({ nickname: 'test' });
  });

  it('should have default status as LINKED', () => {
    const account = new SocialAccount();
    account.status = SocialAccountStatus.LINKED;
    expect(account.status).toBe(SocialAccountStatus.LINKED);
  });

  it('should allow nullable token fields', () => {
    const account = new SocialAccount();
    account.userId = 'user-uuid';
    account.provider = SocialProvider.WECHAT_MINIPROGRAM;
    account.providerUserId = 'openid-456';
    account.accessToken = null;
    account.refreshToken = null;
    account.tokenExpiresAt = null;

    expect(account.accessToken).toBeNull();
    expect(account.refreshToken).toBeNull();
    expect(account.tokenExpiresAt).toBeNull();
  });

  it('should support UNLINKED status', () => {
    const account = new SocialAccount();
    account.status = SocialAccountStatus.UNLINKED;
    account.unboundAt = new Date();

    expect(account.status).toBe(SocialAccountStatus.UNLINKED);
    expect(account.unboundAt).toBeInstanceOf(Date);
  });
});
