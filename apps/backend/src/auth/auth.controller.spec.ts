import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserStatus } from '../entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  const mockRequest = {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto: RegisterDto = {
      username: 'testuser',
      password: 'Password123',
      email: 'test@example.com',
    };

    it('should call authService.register with correct parameters', async () => {
      const expectedResult = {
        id: 'uuid-123',
        username: 'testuser',
        status: UserStatus.PENDING,
        createdAt: new Date(),
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      username: 'testuser',
      password: 'Password123',
    };

    it('should call authService.login with correct parameters', async () => {
      const expectedResult = {
        user: {
          id: 'uuid-123',
          username: 'testuser',
          email: 'test@example.com',
          phone: null,
          status: UserStatus.ACTIVE,
        },
        message: 'Login successful',
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto, mockRequest);

      expect(result).toEqual(expectedResult);
      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, '127.0.0.1');
    });

    it('should use socket.remoteAddress when ip is not available', async () => {
      const requestWithoutIp = {
        ip: undefined,
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const expectedResult = {
        user: {
          id: 'uuid-123',
          username: 'testuser',
          email: 'test@example.com',
          phone: null,
          status: UserStatus.ACTIVE,
        },
        message: 'Login successful',
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      await controller.login(loginDto, requestWithoutIp);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, '192.168.1.1');
    });
  });
});
