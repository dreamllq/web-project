import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  VersioningType,
  VERSION_NEUTRAL,
  ValidationPipe,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { mock, describe, it, expect, afterEach, beforeAll, afterAll } from 'bun:test';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { UsersController } from '../../src/users/users.controller';
import { UsersService } from '../../src/users/users.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { WechatOAuthService } from '../../src/auth/oauth/wechat.service';
import { WechatMiniprogramService } from '../../src/auth/oauth/wechat-miniprogram.service';
import { DingtalkMiniprogramService } from '../../src/auth/oauth/dingtalk-miniprogram.service';
import { MailService } from '../../src/mail/mail.service';
import { VerificationTokenService } from '../../src/auth/services/verification-token.service';
import { CustomCacheService } from '../../src/custom-cache/custom-cache.service';
import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { User, UserStatus } from '../../src/entities/user.entity';

describe('User Center E2E', () => {
  let app: INestApplication;
  let mockAuthService: any;
  let mockUsersService: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockMailService: any;
  let mockVerificationTokenService: any;
  let mockCacheService: any;
  let mockWechatOAuthService: any;
  let mockWechatMiniprogramService: any;
  let mockDingtalkMiniprogramService: any;

  // Test user data
  const testUser: User = {
    id: 'test-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    phone: null,
    passwordHash: 'hashed_password',
    nickname: 'Test User',
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    locale: 'zh-CN',
    lastLoginAt: null,
    lastLoginIp: null,
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
    verificationTokens: [],
  } as User;

  const validAccessToken = 'valid_access_token';
  const validRefreshToken = 'valid_refresh_token';

  const createTestingModule = async (): Promise<TestingModule> => {
    // Create mocks
    mockAuthService = {
      register: mock(),
      login: mock(),
      refreshToken: mock(),
      logout: mock(),
      forgotPassword: mock(),
      resetPassword: mock(),
      requestEmailVerification: mock(),
      verifyEmail: mock(),
      validateAccessToken: mock(),
      generateTokens: mock(),
      hashPassword: mock(),
      comparePassword: mock(),
      validateUser: mock(),
      isTokenBlacklisted: mock(),
    };

    mockUsersService = {
      create: mock(),
      findById: mock(),
      findByUsername: mock(),
      findByEmail: mock(),
      findByPhone: mock(),
      updateLastLogin: mock(),
      updateStatus: mock(),
      updateEmailVerifiedAt: mock(),
      updatePassword: mock(),
      updateProfile: mock(),
      changePassword: mock(),
      softDelete: mock(),
      createOAuthUser: mock(),
      findSocialAccount: mock(),
      createSocialAccount: mock(),
      generateOAuthUsername: mock(),
    };

    mockJwtService = {
      sign: mock(),
      verify: mock(),
    };

    mockConfigService = {
      get: mock().mockImplementation((key: string) => {
        if (key === 'jwt') {
          return {
            secret: 'test-secret-key',
            accessTokenExpiresIn: '15m',
            refreshTokenExpiresIn: '7d',
          };
        }
        if (key === 'frontendUrl') {
          return 'http://localhost:5173';
        }
        return null;
      }),
    };

    mockMailService = {
      sendVerificationEmail: mock(),
      sendPasswordResetEmail: mock(),
    };

    mockVerificationTokenService = {
      generateToken: mock(),
      validateToken: mock(),
      markAsUsed: mock(),
      invalidateUserTokens: mock(),
    };

    mockCacheService = {
      get: mock(),
      set: mock(),
      del: mock(),
    };

    mockWechatOAuthService = {
      getAuthorizationUrl: mock(),
      handleCallback: mock(),
    };

    mockWechatMiniprogramService = {
      login: mock(),
    };

    mockDingtalkMiniprogramService = {
      login: mock(),
    };

    return Test.createTestingModule({
      controllers: [AuthController, UsersController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MailService,
          useValue: mockMailService,
        },
        {
          provide: VerificationTokenService,
          useValue: mockVerificationTokenService,
        },
        {
          provide: CustomCacheService,
          useValue: mockCacheService,
        },
        {
          provide: WechatOAuthService,
          useValue: mockWechatOAuthService,
        },
        {
          provide: WechatMiniprogramService,
          useValue: mockWechatMiniprogramService,
        },
        {
          provide: DingtalkMiniprogramService,
          useValue: mockDingtalkMiniprogramService,
        },
        JwtAuthGuard,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const request = context.switchToHttp().getRequest();
          const authHeader = request.headers?.authorization;

          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Invalid or expired token');
          }

          const token = authHeader.replace('Bearer ', '');
          if (token === validAccessToken) {
            request.user = testUser;
            return true;
          }

          throw new UnauthorizedException('Invalid or expired token');
        },
      })
      .compile();
  };

  beforeAll(async () => {
    const moduleFixture = await createTestingModule();

    app = moduleFixture.createNestApplication();

    // Configure app like main.ts
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: VERSION_NEUTRAL,
    });
    app.setGlobalPrefix('api');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    // Clear all mocks individually
    mockAuthService.register.mockClear();
    mockAuthService.login.mockClear();
    mockAuthService.refreshToken.mockClear();
    mockAuthService.logout.mockClear();
    mockAuthService.forgotPassword.mockClear();
    mockAuthService.resetPassword.mockClear();
    mockAuthService.requestEmailVerification.mockClear();
    mockAuthService.verifyEmail.mockClear();
    mockAuthService.validateAccessToken.mockClear();
    mockAuthService.generateTokens.mockClear();
    mockAuthService.hashPassword.mockClear();
    mockAuthService.comparePassword.mockClear();
    mockAuthService.validateUser.mockClear();
    mockAuthService.isTokenBlacklisted.mockClear();

    mockUsersService.create.mockClear();
    mockUsersService.findById.mockClear();
    mockUsersService.findByUsername.mockClear();
    mockUsersService.findByEmail.mockClear();
    mockUsersService.findByPhone.mockClear();
    mockUsersService.updateLastLogin.mockClear();
    mockUsersService.updateStatus.mockClear();
    mockUsersService.updateEmailVerifiedAt.mockClear();
    mockUsersService.updatePassword.mockClear();
    mockUsersService.updateProfile.mockClear();
    mockUsersService.changePassword.mockClear();
    mockUsersService.softDelete.mockClear();
    mockUsersService.createOAuthUser.mockClear();
    mockUsersService.findSocialAccount.mockClear();
    mockUsersService.createSocialAccount.mockClear();
    mockUsersService.generateOAuthUsername.mockClear();

    mockJwtService.sign.mockClear();
    mockJwtService.verify.mockClear();

    mockConfigService.get.mockClear();

    mockMailService.sendVerificationEmail.mockClear();
    mockMailService.sendPasswordResetEmail.mockClear();

    mockVerificationTokenService.generateToken.mockClear();
    mockVerificationTokenService.validateToken.mockClear();
    mockVerificationTokenService.markAsUsed.mockClear();
    mockVerificationTokenService.invalidateUserTokens.mockClear();

    mockCacheService.get.mockClear();
    mockCacheService.set.mockClear();
    mockCacheService.del.mockClear();

    mockWechatOAuthService.getAuthorizationUrl.mockClear();
    mockWechatOAuthService.handleCallback.mockClear();

    mockWechatMiniprogramService.login.mockClear();

    mockDingtalkMiniprogramService.login.mockClear();
  });

  // ========================================
  // Authentication Flow Tests
  // ========================================
  describe('Authentication Flow', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user and return user info', () => {
        const registerDto = {
          username: 'newuser',
          password: 'Password123',
          email: 'newuser@example.com',
        };

        const expectedResponse = {
          id: 'new-uuid-456',
          username: 'newuser',
          status: UserStatus.PENDING,
          createdAt: expect.any(String),
        };

        mockAuthService.register.mockResolvedValue(expectedResponse as any);

        return request(app.getHttpServer())
          .post('/api/auth/register')
          .send(registerDto)
          .expect(201)
          .expect((res) => {
            expect(res.body).toMatchObject({
              id: 'new-uuid-456',
              username: 'newuser',
              status: UserStatus.PENDING,
            });
            expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
          });
      });

      it('should return 409 when username already exists', () => {
        mockAuthService.register.mockRejectedValue(
          new ConflictException('Username already exists')
        );

        return request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            username: 'existinguser',
            password: 'Password123',
            email: 'test@example.com',
          })
          .expect(409)
          .expect((res) => {
            expect(res.body).toMatchObject({
              statusCode: 409,
              message: 'Username already exists',
            });
          });
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials and return tokens', () => {
        const loginDto = {
          username: 'testuser',
          password: 'Password123',
        };

        const expectedResponse = {
          access_token: validAccessToken,
          refresh_token: validRefreshToken,
          expires_in: 900,
          user: {
            id: testUser.id,
            username: testUser.username,
            email: testUser.email,
            phone: testUser.phone,
            status: testUser.status,
          },
        };

        mockAuthService.login.mockResolvedValue(expectedResponse);

        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send(loginDto)
          .expect(201)
          .expect((res) => {
            expect(res.body).toEqual(expectedResponse);
            expect(mockAuthService.login).toHaveBeenCalledWith(loginDto, expect.any(String));
          });
      });

      it('should return 401 for invalid credentials', () => {
        mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            username: 'testuser',
            password: 'wrongpassword',
          })
          .expect(401)
          .expect((res) => {
            expect(res.body).toMatchObject({
              statusCode: 401,
              message: 'Invalid credentials',
            });
          });
      });
    });

    describe('POST /api/auth/refresh', () => {
      it('should refresh tokens with valid refresh token', () => {
        const expectedResponse = {
          access_token: 'new_access_token',
          refresh_token: 'new_refresh_token',
          expires_in: 900,
        };

        mockAuthService.refreshToken.mockResolvedValue(expectedResponse);

        return request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refresh_token: validRefreshToken })
          .expect(201)
          .expect((res) => {
            expect(res.body).toEqual(expectedResponse);
            expect(mockAuthService.refreshToken).toHaveBeenCalledWith(validRefreshToken);
          });
      });

      it('should return 401 for invalid refresh token', () => {
        mockAuthService.refreshToken.mockRejectedValue(
          new UnauthorizedException('Invalid or expired refresh token')
        );

        return request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refresh_token: 'invalid_token' })
          .expect(401);
      });
    });

    describe('POST /api/auth/logout', () => {
      it('should logout authenticated user', () => {
        mockAuthService.logout.mockResolvedValue(undefined);

        return request(app.getHttpServer())
          .post('/api/auth/logout')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(201)
          .expect((res) => {
            expect(res.body).toEqual({ message: 'Logged out successfully' });
          });
      });

      it('should return 401 without authentication', () => {
        return request(app.getHttpServer()).post('/api/auth/logout').expect(401);
      });
    });
  });

  // ========================================
  // User Profile Management Tests
  // ========================================
  describe('User Profile Management', () => {
    describe('GET /api/v1/users/me', () => {
      it('should return current user info when authenticated', () => {
        return request(app.getHttpServer())
          .get('/api/v1/users/me')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toMatchObject({
              id: testUser.id,
              username: testUser.username,
              email: testUser.email,
              phone: testUser.phone,
              nickname: testUser.nickname,
              status: testUser.status,
              locale: testUser.locale,
            });
          });
      });

      it('should return 401 without authentication', () => {
        return request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
      });
    });

    describe('PATCH /api/v1/users/me', () => {
      it('should update user profile', () => {
        const updateDto = {
          nickname: 'Updated Nickname',
          locale: 'en-US',
        };

        const updatedUser = {
          ...testUser,
          nickname: 'Updated Nickname',
          locale: 'en-US',
        };

        mockUsersService.updateProfile.mockResolvedValue(updatedUser);

        return request(app.getHttpServer())
          .patch('/api/v1/users/me')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .send(updateDto)
          .expect(200)
          .expect((res) => {
            expect(res.body).toMatchObject({
              success: true,
              user: expect.objectContaining({
                nickname: 'Updated Nickname',
                locale: 'en-US',
              }),
            });
          });
      });

      it('should return 401 without authentication', () => {
        return request(app.getHttpServer())
          .patch('/api/v1/users/me')
          .send({ nickname: 'Test' })
          .expect(401);
      });
    });

    describe('PATCH /api/v1/users/me/password', () => {
      it('should change password successfully', () => {
        mockUsersService.changePassword.mockResolvedValue(undefined);

        return request(app.getHttpServer())
          .patch('/api/v1/users/me/password')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .send({
            oldPassword: 'OldPassword123',
            newPassword: 'NewPassword123',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body).toMatchObject({
              success: true,
              message: 'Password changed successfully',
            });
          });
      });

      it('should return 401 for incorrect old password', () => {
        mockUsersService.changePassword.mockRejectedValue(
          new UnauthorizedException('Invalid old password')
        );

        return request(app.getHttpServer())
          .patch('/api/v1/users/me/password')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .send({
            oldPassword: 'WrongOldPassword',
            newPassword: 'NewPassword123',
          })
          .expect(401);
      });

      it('should return 401 without authentication', () => {
        return request(app.getHttpServer())
          .patch('/api/v1/users/me/password')
          .send({
            oldPassword: 'OldPassword123',
            newPassword: 'NewPassword123',
          })
          .expect(401);
      });
    });

    describe('DELETE /api/v1/users/me', () => {
      it('should soft delete account', () => {
        mockUsersService.softDelete.mockResolvedValue(undefined);

        return request(app.getHttpServer())
          .delete('/api/v1/users/me')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toMatchObject({
              success: true,
              message: 'Account deleted successfully',
            });
            expect(mockUsersService.softDelete).toHaveBeenCalledWith(testUser.id);
          });
      });

      it('should return 401 without authentication', () => {
        return request(app.getHttpServer()).delete('/api/v1/users/me').expect(401);
      });
    });
  });

  // ========================================
  // Email Verification Flow Tests
  // ========================================
  describe('Email Verification Flow', () => {
    describe('POST /api/v1/auth/verify-email/request', () => {
      it('should send verification email for authenticated user', () => {
        mockAuthService.requestEmailVerification.mockResolvedValue({
          success: true,
          message: 'Verification email sent',
        });

        return request(app.getHttpServer())
          .post('/api/v1/auth/verify-email/request')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(201)
          .expect((res) => {
            expect(res.body).toMatchObject({
              success: true,
              message: 'Verification email sent',
            });
          });
      });

      it('should return 401 without authentication', () => {
        return request(app.getHttpServer()).post('/api/v1/auth/verify-email/request').expect(401);
      });

      it('should return 400 if email already verified', () => {
        mockAuthService.requestEmailVerification.mockRejectedValue(
          new BadRequestException('Email is already verified')
        );

        return request(app.getHttpServer())
          .post('/api/v1/auth/verify-email/request')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(400);
      });
    });

    describe('POST /api/v1/auth/verify-email/confirm', () => {
      it('should verify email with valid token', () => {
        mockAuthService.verifyEmail.mockResolvedValue({
          success: true,
          message: 'Email verified successfully',
        });

        return request(app.getHttpServer())
          .post('/api/v1/auth/verify-email/confirm')
          .send({ token: 'valid_verification_token' })
          .expect(201)
          .expect((res) => {
            expect(res.body).toMatchObject({
              success: true,
              message: 'Email verified successfully',
            });
          });
      });

      it('should return 400 for invalid token', () => {
        mockAuthService.verifyEmail.mockRejectedValue(
          new BadRequestException('Invalid or expired verification token')
        );

        return request(app.getHttpServer())
          .post('/api/v1/auth/verify-email/confirm')
          .send({ token: 'invalid_token' })
          .expect(400);
      });

      it('should be accessible without authentication (public endpoint)', () => {
        mockAuthService.verifyEmail.mockResolvedValue({
          success: true,
          message: 'Email verified successfully',
        });

        return request(app.getHttpServer())
          .post('/api/v1/auth/verify-email/confirm')
          .send({ token: 'valid_token' })
          .expect(201);
      });
    });
  });

  // ========================================
  // Password Reset Flow Tests
  // ========================================
  describe('Password Reset Flow', () => {
    describe('POST /api/v1/auth/forgot-password', () => {
      it('should return generic response for existing email', () => {
        mockAuthService.forgotPassword.mockResolvedValue({
          success: true,
          message: 'If the email exists, a password reset link will be sent',
        });

        return request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'test@example.com' })
          .expect(201)
          .expect((res) => {
            expect(res.body).toMatchObject({
              success: true,
              message: 'If the email exists, a password reset link will be sent',
            });
          });
      });

      it('should return same generic response for non-existent email (prevent enumeration)', () => {
        mockAuthService.forgotPassword.mockResolvedValue({
          success: true,
          message: 'If the email exists, a password reset link will be sent',
        });

        return request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'nonexistent@example.com' })
          .expect(201)
          .expect((res) => {
            expect(res.body).toMatchObject({
              success: true,
              message: 'If the email exists, a password reset link will be sent',
            });
          });
      });

      it('should be accessible without authentication (public endpoint)', () => {
        mockAuthService.forgotPassword.mockResolvedValue({
          success: true,
          message: 'If the email exists, a password reset link will be sent',
        });

        return request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'test@example.com' })
          .expect(201);
      });
    });

    describe('POST /api/v1/auth/reset-password', () => {
      it('should reset password with valid token', () => {
        mockAuthService.resetPassword.mockResolvedValue({
          success: true,
          message: 'Password reset successfully',
        });

        return request(app.getHttpServer())
          .post('/api/v1/auth/reset-password')
          .send({
            token: 'valid_reset_token',
            newPassword: 'NewSecure123!',
          })
          .expect(201)
          .expect((res) => {
            expect(res.body).toMatchObject({
              success: true,
              message: 'Password reset successfully',
            });
          });
      });

      it('should return 400 for invalid token', () => {
        mockAuthService.resetPassword.mockRejectedValue(
          new BadRequestException('Invalid or expired password reset token')
        );

        return request(app.getHttpServer())
          .post('/api/v1/auth/reset-password')
          .send({
            token: 'invalid_token',
            newPassword: 'NewSecure123!',
          })
          .expect(400);
      });

      it('should be accessible without authentication (public endpoint)', () => {
        mockAuthService.resetPassword.mockResolvedValue({
          success: true,
          message: 'Password reset successfully',
        });

        return request(app.getHttpServer())
          .post('/api/v1/auth/reset-password')
          .send({
            token: 'valid_token',
            newPassword: 'NewSecure123!',
          })
          .expect(201);
      });
    });
  });

  // ========================================
  // API Versioning Tests
  // ========================================
  describe('API Versioning', () => {
    describe('Unversioned routes (VERSION_NEUTRAL)', () => {
      it('should access /api/auth/register without version prefix', () => {
        mockAuthService.register.mockResolvedValue({
          id: 'test-id',
          username: 'test',
          status: UserStatus.PENDING,
          createdAt: new Date(),
        });

        return request(app.getHttpServer())
          .post('/api/auth/register')
          .send({
            username: 'test',
            password: 'Password123',
            email: 'test@example.com',
          })
          .expect(201);
      });

      it('should access /api/auth/login without version prefix', () => {
        mockAuthService.login.mockResolvedValue({
          access_token: 'token',
          refresh_token: 'refresh',
          expires_in: 900,
          user: {
            id: 'id',
            username: 'test',
            email: null,
            phone: null,
            status: UserStatus.ACTIVE,
          },
        });

        return request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            username: 'test',
            password: 'Password123',
          })
          .expect(201);
      });

      it('should access /api/auth/refresh without version prefix', () => {
        mockAuthService.refreshToken.mockResolvedValue({
          access_token: 'new_token',
          refresh_token: 'new_refresh',
          expires_in: 900,
        });

        return request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refresh_token: 'valid_refresh' })
          .expect(201);
      });
    });

    describe('Versioned routes (v1)', () => {
      it('should access /api/v1/users/me with v1 prefix', () => {
        return request(app.getHttpServer())
          .get('/api/v1/users/me')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(200);
      });

      it('should access /api/v1/auth/verify-email/request with v1 prefix', () => {
        mockAuthService.requestEmailVerification.mockResolvedValue({
          success: true,
          message: 'Verification email sent',
        });

        return request(app.getHttpServer())
          .post('/api/v1/auth/verify-email/request')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(201);
      });

      it('should access /api/v1/auth/forgot-password with v1 prefix', () => {
        mockAuthService.forgotPassword.mockResolvedValue({
          success: true,
          message: 'If the email exists, a password reset link will be sent',
        });

        return request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send({ email: 'test@example.com' })
          .expect(201);
      });

      it('should return 404 for /api/v2/users/me (version not defined)', () => {
        return request(app.getHttpServer())
          .get('/api/v2/users/me')
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(404);
      });
    });
  });

  // ========================================
  // Global Exception Handling Tests
  // ========================================
  describe('Global Exception Handling', () => {
    it('should return standardized error format for UnauthorizedException', () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'wrongpassword',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message', 'Invalid credentials');
          expect(res.body).toHaveProperty('error');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path');
        });
    });

    it('should return standardized error format for BadRequestException', () => {
      mockAuthService.verifyEmail.mockRejectedValue(
        new BadRequestException('Invalid or expired verification token')
      );

      return request(app.getHttpServer())
        .post('/api/v1/auth/verify-email/confirm')
        .send({ token: 'invalid' })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 400);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('error');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path');
          expect(res.body.path).toBe('/api/v1/auth/verify-email/confirm');
        });
    });

    it('should return standardized error format for ConflictException', () => {
      mockAuthService.register.mockRejectedValue(new ConflictException('Username already exists'));

      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          username: 'existinguser',
          password: 'Password123',
          email: 'existing@example.com',
        })
        .expect(409)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 409);
          expect(res.body).toHaveProperty('message', 'Username already exists');
          expect(res.body).toHaveProperty('error');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path');
        });
    });

    it('should return 401 for protected route without token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/me')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('error');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path');
        });
    });

    it('should return 401 for protected route with invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', 'Bearer invalid_token')
        .expect(401)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 401);
        });
    });

    it('should return 404 for non-existent route', () => {
      return request(app.getHttpServer())
        .get('/api/nonexistent')
        .expect(404)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 404);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('error');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path', '/api/nonexistent');
        });
    });

    it('should return 400 for validation error (missing required field)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          // Missing username (required)
          password: 'Password123',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 400);
          expect(res.body).toHaveProperty('message');
        });
    });

    it('should return 400 for validation error (forbidden field)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'Password123',
          email: 'test@example.com',
          forbiddenField: 'should not be allowed',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('statusCode', 400);
        });
    });
  });

  // ========================================
  // Complete User Lifecycle Integration Test
  // ========================================
  describe('Complete User Lifecycle', () => {
    it('should complete full user journey: Register → Login → Update → Delete', async () => {
      // Step 1: Register
      mockAuthService.register.mockResolvedValue({
        id: 'lifecycle-user-id',
        username: 'lifecycleuser',
        status: UserStatus.PENDING,
        createdAt: new Date(),
      });

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          username: 'lifecycleuser',
          password: 'Password123',
          email: 'lifecycle@example.com',
        })
        .expect(201);

      // Step 2: Login
      mockAuthService.login.mockResolvedValue({
        access_token: validAccessToken,
        refresh_token: validRefreshToken,
        expires_in: 900,
        user: {
          id: testUser.id,
          username: testUser.username,
          email: testUser.email,
          phone: null,
          status: UserStatus.ACTIVE,
        },
      });

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'lifecycleuser',
          password: 'Password123',
        })
        .expect(201);

      // Step 3: Get profile
      await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);

      // Step 4: Update profile
      mockUsersService.updateProfile.mockResolvedValue({
        ...testUser,
        nickname: 'Updated Name',
      });

      await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({ nickname: 'Updated Name' })
        .expect(200);

      // Step 5: Change password
      mockUsersService.changePassword.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .patch('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .send({
          oldPassword: 'Password123',
          newPassword: 'NewPassword456',
        })
        .expect(200);

      // Step 6: Delete account
      mockUsersService.softDelete.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${validAccessToken}`)
        .expect(200);
    });
  });
});
