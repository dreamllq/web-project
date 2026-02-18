import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UserDevice } from '../../entities/user-device.entity';
import { UserDeviceService, RegisterDeviceInput } from './user-device.service';

describe('UserDeviceService', () => {
  let service: UserDeviceService;

  const mockUserDevice: UserDevice = {
    id: 'device-uuid-123',
    userId: 'user-uuid-123',
    deviceFingerprint: 'fingerprint-hash-123',
    deviceName: 'Chrome on Windows',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    ipAddress: '192.168.1.1',
    trusted: false,
    lastUsedAt: new Date('2026-02-18T10:00:00Z'),
    createdAt: new Date('2026-02-18T09:00:00Z'),
    updatedAt: new Date('2026-02-18T10:00:00Z'),
    user: null as any,
  };

  const mockUserDeviceRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserDeviceService,
        {
          provide: getRepositoryToken(UserDevice),
          useValue: mockUserDeviceRepository,
        },
      ],
    }).compile();

    service = module.get<UserDeviceService>(UserDeviceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateFingerprint', () => {
    it('should generate a consistent fingerprint for same inputs', () => {
      const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
      const ip = '192.168.1.1';

      const fingerprint1 = service.generateFingerprint(userAgent, ip);
      const fingerprint2 = service.generateFingerprint(userAgent, ip);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toHaveLength(64); // SHA-256 hex digest
    });

    it('should generate different fingerprints for different inputs', () => {
      const fingerprint1 = service.generateFingerprint('userAgent1', '192.168.1.1');
      const fingerprint2 = service.generateFingerprint('userAgent2', '192.168.1.1');
      const fingerprint3 = service.generateFingerprint('userAgent1', '192.168.1.2');

      expect(fingerprint1).not.toBe(fingerprint2);
      expect(fingerprint1).not.toBe(fingerprint3);
    });

    it('should generate SHA-256 hex string', () => {
      const fingerprint = service.generateFingerprint('test-agent', '10.0.0.1');

      // SHA-256 produces 64 character hex string
      expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('registerDevice', () => {
    const userId = 'user-uuid-123';
    const deviceInput: RegisterDeviceInput = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      ipAddress: '192.168.1.1',
      deviceName: 'Chrome on Windows',
    };

    it('should create a new device when it does not exist', async () => {
      const newDevice = { ...mockUserDevice };
      mockUserDeviceRepository.findOne.mockResolvedValue(null);
      mockUserDeviceRepository.create.mockReturnValue(newDevice);
      mockUserDeviceRepository.save.mockResolvedValue(newDevice);

      const result = await service.registerDevice(userId, deviceInput);

      expect(result).toEqual(newDevice);
      expect(mockUserDeviceRepository.findOne).toHaveBeenCalled();
      expect(mockUserDeviceRepository.create).toHaveBeenCalled();
      expect(mockUserDeviceRepository.save).toHaveBeenCalled();
    });

    it('should update existing device when fingerprint matches', async () => {
      const existingDevice = { ...mockUserDevice, lastUsedAt: new Date('2026-02-18T08:00:00Z') };
      mockUserDeviceRepository.findOne.mockResolvedValue(existingDevice);
      mockUserDeviceRepository.save.mockImplementation((device) => Promise.resolve(device));

      const result = await service.registerDevice(userId, deviceInput);

      expect(mockUserDeviceRepository.findOne).toHaveBeenCalled();
      expect(mockUserDeviceRepository.save).toHaveBeenCalled();
      expect(result.lastUsedAt).not.toEqual(new Date('2026-02-18T08:00:00Z'));
    });

    it('should update IP address on existing device', async () => {
      const existingDevice = { ...mockUserDevice, ipAddress: '192.168.1.100' };
      mockUserDeviceRepository.findOne.mockResolvedValue(existingDevice);
      mockUserDeviceRepository.save.mockImplementation((device) => Promise.resolve(device));

      const result = await service.registerDevice(userId, {
        ...deviceInput,
        ipAddress: '192.168.1.200',
      });

      expect(result.ipAddress).toBe('192.168.1.200');
    });

    it('should update device name on existing device when provided', async () => {
      const existingDevice = { ...mockUserDevice };
      mockUserDeviceRepository.findOne.mockResolvedValue(existingDevice);
      mockUserDeviceRepository.save.mockImplementation((device) => Promise.resolve(device));

      const result = await service.registerDevice(userId, {
        ...deviceInput,
        deviceName: 'New Device Name',
      });

      expect(result.deviceName).toBe('New Device Name');
    });

    it('should create device without deviceName if not provided', async () => {
      const inputWithoutName: RegisterDeviceInput = {
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };
      const newDevice = { ...mockUserDevice, deviceName: null };
      mockUserDeviceRepository.findOne.mockResolvedValue(null);
      mockUserDeviceRepository.create.mockReturnValue(newDevice);
      mockUserDeviceRepository.save.mockResolvedValue(newDevice);

      const result = await service.registerDevice(userId, inputWithoutName);

      expect(result.deviceName).toBeNull();
    });

    it('should generate random fingerprint when userAgent or IP is missing', async () => {
      const inputMissingInfo: RegisterDeviceInput = {
        userAgent: undefined,
        ipAddress: undefined,
      };
      const newDevice = { ...mockUserDevice };
      mockUserDeviceRepository.findOne.mockResolvedValue(null);
      mockUserDeviceRepository.create.mockReturnValue(newDevice);
      mockUserDeviceRepository.save.mockResolvedValue(newDevice);

      await service.registerDevice(userId, inputMissingInfo);

      expect(mockUserDeviceRepository.create).toHaveBeenCalled();
    });
  });

  describe('getUserDevices', () => {
    const userId = 'user-uuid-123';

    it('should return all devices for a user', async () => {
      const devices = [
        mockUserDevice,
        { ...mockUserDevice, id: 'device-uuid-456', deviceName: 'Safari on Mac' },
      ];
      mockUserDeviceRepository.find.mockResolvedValue(devices);

      const result = await service.getUserDevices(userId);

      expect(result).toHaveLength(2);
      expect(mockUserDeviceRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { lastUsedAt: 'DESC' },
      });
    });

    it('should return empty array when user has no devices', async () => {
      mockUserDeviceRepository.find.mockResolvedValue([]);

      const result = await service.getUserDevices(userId);

      expect(result).toEqual([]);
    });

    it('should return DeviceInfo objects without user relation', async () => {
      mockUserDeviceRepository.find.mockResolvedValue([mockUserDevice]);

      const result = await service.getUserDevices(userId);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('userId');
      expect(result[0]).toHaveProperty('deviceFingerprint');
      expect(result[0]).toHaveProperty('trusted');
      expect(result[0]).not.toHaveProperty('user');
    });
  });

  describe('trustDevice', () => {
    const userId = 'user-uuid-123';
    const deviceId = 'device-uuid-123';

    it('should mark a device as trusted', async () => {
      const untrustedDevice = { ...mockUserDevice, trusted: false };
      mockUserDeviceRepository.findOne.mockResolvedValue(untrustedDevice);
      mockUserDeviceRepository.save.mockImplementation((device) => Promise.resolve(device));

      const result = await service.trustDevice(userId, deviceId);

      expect(result.trusted).toBe(true);
      expect(mockUserDeviceRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException when device does not exist', async () => {
      mockUserDeviceRepository.findOne.mockResolvedValue(null);

      await expect(service.trustDevice(userId, deviceId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when device belongs to another user', async () => {
      const deviceFromOtherUser = { ...mockUserDevice, userId: 'other-user-uuid' };
      mockUserDeviceRepository.findOne.mockResolvedValue(deviceFromOtherUser);

      await expect(service.trustDevice(userId, deviceId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeDevice', () => {
    const userId = 'user-uuid-123';
    const deviceId = 'device-uuid-123';

    it('should remove a device', async () => {
      mockUserDeviceRepository.findOne.mockResolvedValue(mockUserDevice);
      mockUserDeviceRepository.remove.mockResolvedValue(mockUserDevice);

      await service.removeDevice(userId, deviceId);

      expect(mockUserDeviceRepository.remove).toHaveBeenCalledWith(mockUserDevice);
    });

    it('should throw NotFoundException when device does not exist', async () => {
      mockUserDeviceRepository.findOne.mockResolvedValue(null);

      await expect(service.removeDevice(userId, deviceId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when device belongs to another user', async () => {
      const deviceFromOtherUser = { ...mockUserDevice, userId: 'other-user-uuid' };
      mockUserDeviceRepository.findOne.mockResolvedValue(deviceFromOtherUser);

      await expect(service.removeDevice(userId, deviceId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findDeviceById', () => {
    const userId = 'user-uuid-123';
    const deviceId = 'device-uuid-123';

    it('should return device when found', async () => {
      mockUserDeviceRepository.findOne.mockResolvedValue(mockUserDevice);

      const result = await service.findDeviceById(userId, deviceId);

      expect(result).toEqual(mockUserDevice);
      expect(mockUserDeviceRepository.findOne).toHaveBeenCalledWith({
        where: { id: deviceId, userId },
      });
    });

    it('should return null when device not found', async () => {
      mockUserDeviceRepository.findOne.mockResolvedValue(null);

      const result = await service.findDeviceById(userId, deviceId);

      expect(result).toBeNull();
    });
  });

  describe('isDeviceTrusted', () => {
    const userId = 'user-uuid-123';
    const deviceId = 'device-uuid-123';

    it('should return true when device is trusted', async () => {
      const trustedDevice = { ...mockUserDevice, trusted: true };
      mockUserDeviceRepository.findOne.mockResolvedValue(trustedDevice);

      const result = await service.isDeviceTrusted(userId, deviceId);

      expect(result).toBe(true);
    });

    it('should return false when device is not trusted', async () => {
      const untrustedDevice = { ...mockUserDevice, trusted: false };
      mockUserDeviceRepository.findOne.mockResolvedValue(untrustedDevice);

      const result = await service.isDeviceTrusted(userId, deviceId);

      expect(result).toBe(false);
    });

    it('should return false when device not found', async () => {
      mockUserDeviceRepository.findOne.mockResolvedValue(null);

      const result = await service.isDeviceTrusted(userId, deviceId);

      expect(result).toBe(false);
    });
  });

  describe('countUserDevices', () => {
    const userId = 'user-uuid-123';

    it('should return count of user devices', async () => {
      mockUserDeviceRepository.count.mockResolvedValue(5);

      const result = await service.countUserDevices(userId);

      expect(result).toBe(5);
      expect(mockUserDeviceRepository.count).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('should return 0 when user has no devices', async () => {
      mockUserDeviceRepository.count.mockResolvedValue(0);

      const result = await service.countUserDevices(userId);

      expect(result).toBe(0);
    });
  });

  describe('removeAllUserDevices', () => {
    const userId = 'user-uuid-123';

    it('should delete all devices for a user', async () => {
      mockUserDeviceRepository.delete.mockResolvedValue({ affected: 3 });

      await service.removeAllUserDevices(userId);

      expect(mockUserDeviceRepository.delete).toHaveBeenCalledWith({ userId });
    });
  });
});
