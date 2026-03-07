import { describe, it, expect } from 'bun:test';
import { validate } from 'class-validator';
import { FeishuAuthDto, FeishuCallbackDto } from './feishu.dto';

describe('FeishuAuthDto', () => {
  it('should accept valid state parameter', async () => {
    const dto = new FeishuAuthDto();
    dto.state = 'random-state-string';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept empty state (optional)', async () => {
    const dto = new FeishuAuthDto();

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept state as string', async () => {
    const dto = new FeishuAuthDto();
    dto.state = 'test-state-123';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });
});

describe('FeishuCallbackDto', () => {
  it('should accept valid code and state', async () => {
    const dto = new FeishuCallbackDto();
    dto.code = 'authorization-code';
    dto.state = 'state-string';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should accept code without state', async () => {
    const dto = new FeishuCallbackDto();
    dto.code = 'authorization-code';

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it('should reject missing code', async () => {
    const dto = new FeishuCallbackDto();
    dto.state = 'state-string';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('code');
  });

  it('should reject empty code', async () => {
    const dto = new FeishuCallbackDto();
    dto.code = '';

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('code');
  });
});
