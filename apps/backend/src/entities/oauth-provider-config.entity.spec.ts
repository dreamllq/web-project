import { OAuthProviderConfig, OAuthProviderCode } from './oauth-provider-config.entity';

describe('OAuthProviderConfig Entity', () => {
  describe('properties', () => {
    it('should have correct default values', () => {
      const config = new OAuthProviderConfig();
      config.id = 'config-uuid-123';
      config.code = OAuthProviderCode.WECHAT;
      config.name = 'WeChat';
      config.appId = 'wx1234567890';
      config.appSecret = 'secret123';
      config.redirectUri = 'http://localhost:3001/callback';
      config.enabled = true;
      config.config = { scope: 'snsapi_userinfo' };
      config.createdAt = new Date();
      config.updatedAt = new Date();

      expect(config.id).toBe('config-uuid-123');
      expect(config.code).toBe(OAuthProviderCode.WECHAT);
      expect(config.name).toBe('WeChat');
      expect(config.appId).toBe('wx1234567890');
      expect(config.appSecret).toBe('secret123');
      expect(config.redirectUri).toBe('http://localhost:3001/callback');
      expect(config.enabled).toBe(true);
      expect(config.config).toEqual({ scope: 'snsapi_userinfo' });
      expect(config.createdAt).toBeInstanceOf(Date);
      expect(config.updatedAt).toBeInstanceOf(Date);
    });

    it('should allow nullable redirectUri', () => {
      const config = new OAuthProviderConfig();
      config.id = 'config-uuid-456';
      config.code = OAuthProviderCode.WECHAT_MINIPROGRAM;
      config.name = 'WeChat Mini Program';
      config.appId = 'wx0987654321';
      config.appSecret = 'secret456';
      config.redirectUri = null;
      config.enabled = true;
      config.config = null;
      config.createdAt = new Date();
      config.updatedAt = new Date();

      expect(config.redirectUri).toBeNull();
      expect(config.config).toBeNull();
    });

    it('should support disabled providers', () => {
      const config = new OAuthProviderConfig();
      config.id = 'config-uuid-789';
      config.code = OAuthProviderCode.DINGTALK;
      config.name = 'DingTalk';
      config.appId = 'dt123456';
      config.appSecret = 'secret789';
      config.redirectUri = 'http://localhost:3001/dingtalk/callback';
      config.enabled = false;
      config.config = null;
      config.createdAt = new Date();
      config.updatedAt = new Date();

      expect(config.enabled).toBe(false);
    });
  });

  describe('OAuthProviderCode enum', () => {
    it('should have WECHAT value', () => {
      expect(OAuthProviderCode.WECHAT).toBe('wechat');
    });

    it('should have WECHAT_MINIPROGRAM value', () => {
      expect(OAuthProviderCode.WECHAT_MINIPROGRAM).toBe('wechat_miniprogram');
    });

    it('should have DINGTALK_MINIPROGRAM value', () => {
      expect(OAuthProviderCode.DINGTALK_MINIPROGRAM).toBe('dingtalk_miniprogram');
    });

    it('should have DINGTALK value', () => {
      expect(OAuthProviderCode.DINGTALK).toBe('dingtalk');
    });

    it('should have FEISHU value', () => {
      expect(OAuthProviderCode.FEISHU).toBe('feishu');
    });

    it('should have DOUYIN value', () => {
      expect(OAuthProviderCode.DOUYIN).toBe('douyin');
    });

    it('should have QQ value', () => {
      expect(OAuthProviderCode.QQ).toBe('qq');
    });

    it('should have BAIDU value', () => {
      expect(OAuthProviderCode.BAIDU).toBe('baidu');
    });

    it('should have all 8 provider codes', () => {
      const codes = Object.values(OAuthProviderCode);
      expect(codes).toHaveLength(8);
      expect(codes).toContain('wechat');
      expect(codes).toContain('wechat_miniprogram');
      expect(codes).toContain('dingtalk_miniprogram');
      expect(codes).toContain('dingtalk');
      expect(codes).toContain('feishu');
      expect(codes).toContain('douyin');
      expect(codes).toContain('qq');
      expect(codes).toContain('baidu');
    });
  });

  describe('config field', () => {
    it('should support complex config objects', () => {
      const config = new OAuthProviderConfig();
      config.id = 'config-uuid-complex';
      config.code = OAuthProviderCode.WECHAT;
      config.name = 'WeChat';
      config.appId = 'wx1234567890';
      config.appSecret = 'secret123';
      config.redirectUri = 'http://localhost:3001/callback';
      config.enabled = true;
      config.config = {
        scope: 'snsapi_userinfo',
        state: 'random_state',
        extraParams: {
          agentId: 'agent123',
        },
      };
      config.createdAt = new Date();
      config.updatedAt = new Date();

      expect(config.config).toEqual({
        scope: 'snsapi_userinfo',
        state: 'random_state',
        extraParams: {
          agentId: 'agent123',
        },
      });
    });
  });

  describe('metadata fields', () => {
    it('should support displayName field', () => {
      const config = new OAuthProviderConfig();
      config.displayName = '微信';

      expect(config.displayName).toBe('微信');
    });

    it('should support icon field', () => {
      const config = new OAuthProviderConfig();
      config.icon = 'ChatDotRound';

      expect(config.icon).toBe('ChatDotRound');
    });

    it('should support color field', () => {
      const config = new OAuthProviderConfig();
      config.color = '#07C160';

      expect(config.color).toBe('#07C160');
    });

    it('should support providerType field', () => {
      const config = new OAuthProviderConfig();
      config.providerType = 'oauth2';

      expect(config.providerType).toBe('oauth2');
    });

    it('should support sortOrder field', () => {
      const config = new OAuthProviderConfig();
      config.sortOrder = 1;

      expect(config.sortOrder).toBe(1);
    });

    it('should allow nullable metadata fields', () => {
      const config = new OAuthProviderConfig();
      config.displayName = null;
      config.icon = null;
      config.color = null;
      config.providerType = null;
      config.sortOrder = null;

      expect(config.displayName).toBeNull();
      expect(config.icon).toBeNull();
      expect(config.color).toBeNull();
      expect(config.providerType).toBeNull();
      expect(config.sortOrder).toBeNull();
    });
  });
});
