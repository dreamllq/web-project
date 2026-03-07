import {
  DouyinAuthDto,
  DouyinCallbackDto,
  DouyinAccessTokenResponse,
  DouyinUserInfo,
  DouyinAuthUrlResponse,
  DouyinErrorResponse,
} from './douyin.dto';

describe('Douyin DTOs', () => {
  describe('DouyinAuthDto', () => {
    it('should have code property as string', () => {
      const dto = new DouyinAuthDto();
      dto.code = 'test-code';

      expect(dto.code).toBe('test-code');
      expect(typeof dto.code).toBe('string');
    });

    it('should have optional state property', () => {
      const dto = new DouyinAuthDto();
      dto.code = 'test-code';
      dto.state = 'test-state';

      expect(dto.state).toBe('test-state');
      expect(dto.state).toBeDefined();
    });

    it('should allow state to be undefined', () => {
      const dto = new DouyinAuthDto();
      dto.code = 'test-code';

      expect(dto.state).toBeUndefined();
    });
  });

  describe('DouyinCallbackDto', () => {
    it('should have code property as string', () => {
      const dto = new DouyinCallbackDto();
      dto.code = 'callback-code';

      expect(dto.code).toBe('callback-code');
      expect(typeof dto.code).toBe('string');
    });

    it('should have optional state property', () => {
      const dto = new DouyinCallbackDto();
      dto.code = 'callback-code';
      dto.state = 'callback-state';

      expect(dto.state).toBe('callback-state');
    });

    it('should allow state to be undefined', () => {
      const dto = new DouyinCallbackDto();
      dto.code = 'callback-code';

      expect(dto.state).toBeUndefined();
    });
  });

  describe('DouyinAccessTokenResponse interface', () => {
    it('should define correct structure', () => {
      const response: DouyinAccessTokenResponse = {
        access_token: 'test-access-token',
        expires_in: 7200,
        refresh_token: 'test-refresh-token',
        open_id: 'test-open-id',
        scope: 'user_info',
      };

      expect(response.access_token).toBe('test-access-token');
      expect(response.expires_in).toBe(7200);
      expect(response.refresh_token).toBe('test-refresh-token');
      expect(response.open_id).toBe('test-open-id');
      expect(response.scope).toBe('user_info');
    });
  });

  describe('DouyinUserInfo interface', () => {
    it('should define required fields', () => {
      const userInfo: DouyinUserInfo = {
        open_id: 'test-open-id',
        union_id: 'test-union-id',
        nickname: 'test-nickname',
        avatar: 'https://example.com/avatar.jpg',
      };

      expect(userInfo.open_id).toBe('test-open-id');
      expect(userInfo.union_id).toBe('test-union-id');
      expect(userInfo.nickname).toBe('test-nickname');
      expect(userInfo.avatar).toBe('https://example.com/avatar.jpg');
    });

    it('should support optional location fields', () => {
      const userInfo: DouyinUserInfo = {
        open_id: 'test-open-id',
        union_id: 'test-union-id',
        nickname: 'test-nickname',
        avatar: 'https://example.com/avatar.jpg',
        city: 'Beijing',
        province: 'Beijing',
        country: 'China',
      };

      expect(userInfo.city).toBe('Beijing');
      expect(userInfo.province).toBe('Beijing');
      expect(userInfo.country).toBe('China');
    });
  });

  describe('DouyinAuthUrlResponse interface', () => {
    it('should define url property', () => {
      const response: DouyinAuthUrlResponse = {
        url: 'https://open.douyin.com/platform/oauth/connect?scope=user_info',
      };

      expect(response.url).toBe('https://open.douyin.com/platform/oauth/connect?scope=user_info');
    });
  });

  describe('DouyinErrorResponse interface', () => {
    it('should define error structure', () => {
      const error: DouyinErrorResponse = {
        errcode: 10001,
        errmsg: 'Invalid parameter',
      };

      expect(error.errcode).toBe(10001);
      expect(error.errmsg).toBe('Invalid parameter');
    });
  });
});
