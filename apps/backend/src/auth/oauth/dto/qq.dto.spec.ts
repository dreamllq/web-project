import { describe, it, expect } from 'bun:test';
import { validate } from 'class-validator';
import { QQAuthDto, QQCallbackDto } from './qq.dto';

describe('QQAuthDto', () => {
  it('should validate with required code', async () => {
    const dto = new QQAuthDto();
    dto.code = 'test_code';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate with code and optional state', async () => {
    const dto = new QQAuthDto();
    dto.code = 'test_code';
    dto.state = 'test_state';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail without code', async () => {
    const dto = new QQAuthDto();

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('code');
  });

  it('should fail if code is not string', async () => {
    const dto = new QQAuthDto();
    (dto as any).code = 123;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('code');
  });
});

describe('QQCallbackDto', () => {
  it('should validate with required code', async () => {
    const dto = new QQCallbackDto();
    dto.code = 'callback_code';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should validate with code and optional state', async () => {
    const dto = new QQCallbackDto();
    dto.code = 'callback_code';
    dto.state = 'callback_state';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should fail without code', async () => {
    const dto = new QQCallbackDto();

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('code');
  });
});

describe('QQ Interface Types', () => {
  it('should define QQAccessTokenResponse interface correctly', () => {
    const response = {
      access_token: 'test_token',
      expires_in: 3600,
      refresh_token: 'refresh_token',
    };

    expect(response.access_token).toBe('test_token');
    expect(response.expires_in).toBe(3600);
    expect(response.refresh_token).toBe('refresh_token');
  });

  it('should define QQOpenIdResponse interface correctly', () => {
    const response = {
      client_id: 'test_client',
      openid: 'test_openid',
      unionid: 'test_unionid',
    };

    expect(response.client_id).toBe('test_client');
    expect(response.openid).toBe('test_openid');
    expect(response.unionid).toBe('test_unionid');
  });

  it('should define QQUserInfo interface correctly', () => {
    const userInfo = {
      openid: 'test_openid',
      unionid: 'test_unionid',
      nickname: 'TestUser',
      figureurl_qq_1: 'https://example.com/avatar.jpg',
      gender: '男',
    };

    expect(userInfo.openid).toBe('test_openid');
    expect(userInfo.nickname).toBe('TestUser');
    expect(userInfo.figureurl_qq_1).toBe('https://example.com/avatar.jpg');
  });

  it('should define QQErrorResponse interface correctly', () => {
    const errorResponse = {
      error: 'invalid_request',
      error_description: 'The request is missing a required parameter',
    };

    expect(errorResponse.error).toBe('invalid_request');
    expect(errorResponse.error_description).toBe('The request is missing a required parameter');
  });
});
