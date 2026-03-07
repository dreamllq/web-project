import { describe, it, expect } from 'bun:test';
import { validate } from 'class-validator';
import { BaiduAuthDto, BaiduCallbackDto } from './baidu.dto';

describe('BaiduAuthDto', () => {
  it('should accept valid state parameter', async () => {
    const dto = new BaiduAuthDto();
    dto.state = 'random-state-string';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept empty state (optional)', async () => {
    const dto = new BaiduAuthDto();

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept state as string', async () => {
    const dto = new BaiduAuthDto();
    dto.state = 'test-state-123';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

describe('BaiduCallbackDto', () => {
  it('should accept valid code and state', async () => {
    const dto = new BaiduCallbackDto();
    dto.code = 'authorization-code';
    dto.state = 'state-string';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept code without state', async () => {
    const dto = new BaiduCallbackDto();
    dto.code = 'authorization-code';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject missing code', async () => {
    const dto = new BaiduCallbackDto();
    dto.state = 'state-string';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('code');
  });

  it('should reject empty code', async () => {
    const dto = new BaiduCallbackDto();
    dto.code = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('code');
  });
});
