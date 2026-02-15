import { Test, TestingModule } from '@nestjs/testing';
import { InitService } from './init.service';

describe('InitService', () => {
  let service: InitService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InitService],
    }).compile();

    service = module.get<InitService>(InitService);
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
});
