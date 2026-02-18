import { Test, TestingModule } from '@nestjs/testing';
import { DeviceController, DeviceResponse } from './device.controller';
import { UserDeviceService, DeviceInfo } from '../services/user-device.service';
import { User, UserStatus } from '../../entities/user.entity';
import { NotFoundException } from '@nestjs/common';
import { TrustDeviceDto } from '../dto/trust-device.dto';
import { RemoveDeviceDto } from '../dto/remove-device.dto';

describe('DeviceController', () => {
  let controller: DeviceController;
  let service: UserDeviceService;

  const mockUser: User = {
    id: 'user-uuid-123',
    username: 'testuser',
    email: 'test@example.com',
    phone: '+1234567890',
    passwordHash: 'hashedpassword',
    nickname: 'Test User',
    avatarUrl: 'http://example.com/avatar.jpg',
    status: UserStatus.ACTIVE,
    locale: 'zh-CN',
    lastLoginAt: new Date(),
    lastLoginIp: '192.168.1.1',
    emailVerifiedAt: new Date(),
    phoneVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
    verificationTokens: [],
  };

  const mockDeviceInfo: DeviceInfo = {
    id: 'device-uuid-123',
    userId: 'user-uuid-123',
    deviceFingerprint: 'abc123fingerprint',
    deviceName: 'Chrome on Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ipAddress: '192.168.1.100',
    trusted: false,
    lastUsedAt: new Date('2024-01-15T10:30:00Z'),
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z'),
  };

  const mockTrustedDeviceInfo: DeviceInfo = {
    ...mockDeviceInfo,
    id: 'device-uuid-456',
    trusted: true,
  };

  const mockUserDeviceService = {
    getUserDevices: jest.fn(),
    trustDevice: jest.fn(),
    removeDevice: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeviceController],
      providers: [
        {
          provide: UserDeviceService,
          useValue: mockUserDeviceService,
        },
      ],
    }).compile();

    controller = module.get<DeviceController>(DeviceController);
    service = module.get<UserDeviceService>(UserDeviceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDevices', () => {
    it('should return list of devices for the current user', async () => {
      const devices = [mockDeviceInfo, mockTrustedDeviceInfo];
      mockUserDeviceService.getUserDevices.mockResolvedValue(devices);

      const result = await controller.getDevices(mockUser);

      expect(result).toEqual({
        data: [
          {
            id: mockDeviceInfo.id,
            deviceName: mockDeviceInfo.deviceName,
            userAgent: mockDeviceInfo.userAgent,
            ipAddress: mockDeviceInfo.ipAddress,
            trusted: mockDeviceInfo.trusted,
            lastUsedAt: mockDeviceInfo.lastUsedAt,
            createdAt: mockDeviceInfo.createdAt,
          },
          {
            id: mockTrustedDeviceInfo.id,
            deviceName: mockTrustedDeviceInfo.deviceName,
            userAgent: mockTrustedDeviceInfo.userAgent,
            ipAddress: mockTrustedDeviceInfo.ipAddress,
            trusted: mockTrustedDeviceInfo.trusted,
            lastUsedAt: mockTrustedDeviceInfo.lastUsedAt,
            createdAt: mockTrustedDeviceInfo.createdAt,
          },
        ],
      });
      expect(service.getUserDevices).toHaveBeenCalledWith(mockUser.id);
    });

    it('should return empty array when user has no devices', async () => {
      mockUserDeviceService.getUserDevices.mockResolvedValue([]);

      const result = await controller.getDevices(mockUser);

      expect(result).toEqual({ data: [] });
      expect(service.getUserDevices).toHaveBeenCalledWith(mockUser.id);
    });

    it('should exclude sensitive fields from response', async () => {
      mockUserDeviceService.getUserDevices.mockResolvedValue([mockDeviceInfo]);

      const result = await controller.getDevices(mockUser);
      const device = result.data[0];

      // Verify sensitive fields are not included
      expect((device as unknown as Record<string, unknown>).deviceFingerprint).toBeUndefined();
      expect((device as unknown as Record<string, unknown>).userId).toBeUndefined();
    });
  });

  describe('trustDevice', () => {
    const trustDeviceDto: TrustDeviceDto = {};
    const deviceId = 'device-uuid-123';

    it('should trust a device successfully', async () => {
      const trustedDevice = { ...mockDeviceInfo, trusted: true };
      mockUserDeviceService.trustDevice.mockResolvedValue(trustedDevice);

      const result = await controller.trustDevice(mockUser, deviceId, trustDeviceDto);

      expect(result).toEqual({
        success: true,
        message: 'Device trusted',
        device: expect.objectContaining({
          id: deviceId,
          trusted: true,
        }),
      });
      expect(service.trustDevice).toHaveBeenCalledWith(mockUser.id, deviceId);
    });

    it('should accept optional note in DTO', async () => {
      const dtoWithNote: TrustDeviceDto = { note: 'My primary laptop' };
      const trustedDevice = { ...mockDeviceInfo, trusted: true };
      mockUserDeviceService.trustDevice.mockResolvedValue(trustedDevice);

      const result = await controller.trustDevice(mockUser, deviceId, dtoWithNote);

      expect(result.success).toBe(true);
      // Note: The note is not currently stored, just accepted for future extension
    });

    it('should throw NotFoundException when device does not exist', async () => {
      mockUserDeviceService.trustDevice.mockRejectedValue(
        new NotFoundException('Device not found')
      );

      await expect(controller.trustDevice(mockUser, deviceId, trustDeviceDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException when device belongs to another user', async () => {
      mockUserDeviceService.trustDevice.mockRejectedValue(
        new NotFoundException('Device not found')
      );

      await expect(controller.trustDevice(mockUser, deviceId, trustDeviceDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('removeDevice', () => {
    const removeDeviceDto: RemoveDeviceDto = {};
    const deviceId = 'device-uuid-123';

    it('should remove a device successfully', async () => {
      mockUserDeviceService.removeDevice.mockResolvedValue(undefined);

      await controller.removeDevice(mockUser, deviceId, removeDeviceDto);

      expect(service.removeDevice).toHaveBeenCalledWith(mockUser.id, deviceId);
    });

    it('should accept optional reason in DTO', async () => {
      const dtoWithReason: RemoveDeviceDto = { reason: 'No longer using this device' };
      mockUserDeviceService.removeDevice.mockResolvedValue(undefined);

      await controller.removeDevice(mockUser, deviceId, dtoWithReason);

      expect(service.removeDevice).toHaveBeenCalledWith(mockUser.id, deviceId);
      // Note: The reason is not currently stored, just accepted for future extension
    });

    it('should throw NotFoundException when device does not exist', async () => {
      mockUserDeviceService.removeDevice.mockRejectedValue(
        new NotFoundException('Device not found')
      );

      await expect(controller.removeDevice(mockUser, deviceId, removeDeviceDto)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw NotFoundException when device belongs to another user', async () => {
      mockUserDeviceService.removeDevice.mockRejectedValue(
        new NotFoundException('Device not found')
      );

      await expect(controller.removeDevice(mockUser, deviceId, removeDeviceDto)).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('toDeviceResponse', () => {
    it('should transform DeviceInfo to DeviceResponse correctly', async () => {
      mockUserDeviceService.getUserDevices.mockResolvedValue([mockDeviceInfo]);

      const result = await controller.getDevices(mockUser);
      const device = result.data[0];

      const expectedFields: (keyof DeviceResponse)[] = [
        'id',
        'deviceName',
        'userAgent',
        'ipAddress',
        'trusted',
        'lastUsedAt',
        'createdAt',
      ];

      expectedFields.forEach((field) => {
        expect(device).toHaveProperty(field);
      });
    });

    it('should handle null values correctly', async () => {
      const deviceWithNulls: DeviceInfo = {
        ...mockDeviceInfo,
        deviceName: null,
        userAgent: null,
        ipAddress: null,
        lastUsedAt: null,
      };
      mockUserDeviceService.getUserDevices.mockResolvedValue([deviceWithNulls]);

      const result = await controller.getDevices(mockUser);
      const device = result.data[0];

      expect(device.deviceName).toBeNull();
      expect(device.userAgent).toBeNull();
      expect(device.ipAddress).toBeNull();
      expect(device.lastUsedAt).toBeNull();
    });
  });
});
