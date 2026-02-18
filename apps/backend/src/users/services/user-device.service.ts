import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { UserDevice } from '../../entities/user-device.entity';

export interface RegisterDeviceInput {
  userAgent?: string;
  ipAddress?: string;
  deviceName?: string;
}

export interface DeviceInfo {
  id: string;
  userId: string;
  deviceFingerprint: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  trusted: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UserDeviceService {
  constructor(
    @InjectRepository(UserDevice)
    private userDeviceRepository: Repository<UserDevice>
  ) {}

  /**
   * Generate a device fingerprint from user agent and IP address
   */
  generateFingerprint(userAgent: string, ip: string): string {
    return createHash('sha256').update(`${userAgent}|${ip}`).digest('hex');
  }

  /**
   * Register a new device or update an existing one
   * If device with same fingerprint exists, updates lastUsedAt
   */
  async registerDevice(userId: string, deviceInfo: RegisterDeviceInput): Promise<UserDevice> {
    const { userAgent, ipAddress, deviceName } = deviceInfo;

    // Generate fingerprint if we have userAgent and IP
    let fingerprint: string;
    if (userAgent && ipAddress) {
      fingerprint = this.generateFingerprint(userAgent, ipAddress);
    } else {
      // Generate a random fingerprint if we don't have enough info
      fingerprint = createHash('sha256').update(`${userId}|${Date.now()}`).digest('hex');
    }

    // Check if device already exists for this user
    const existingDevice = await this.userDeviceRepository.findOne({
      where: { userId, deviceFingerprint: fingerprint },
    });

    if (existingDevice) {
      // Update last used time and optionally other fields
      existingDevice.lastUsedAt = new Date();
      if (ipAddress) {
        existingDevice.ipAddress = ipAddress;
      }
      if (deviceName) {
        existingDevice.deviceName = deviceName;
      }
      return this.userDeviceRepository.save(existingDevice);
    }

    // Create new device
    const newDevice = this.userDeviceRepository.create({
      userId,
      deviceFingerprint: fingerprint,
      deviceName: deviceName || null,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      trusted: false,
      lastUsedAt: new Date(),
    });

    return this.userDeviceRepository.save(newDevice);
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<DeviceInfo[]> {
    const devices = await this.userDeviceRepository.find({
      where: { userId },
      order: { lastUsedAt: 'DESC' },
    });

    return devices.map((device) => this.toDeviceInfo(device));
  }

  /**
   * Trust a device
   */
  async trustDevice(userId: string, deviceId: string): Promise<DeviceInfo> {
    const device = await this.userDeviceRepository.findOne({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Verify device belongs to the user
    if (device.userId !== userId) {
      throw new NotFoundException('Device not found');
    }

    device.trusted = true;
    const updatedDevice = await this.userDeviceRepository.save(device);

    return this.toDeviceInfo(updatedDevice);
  }

  /**
   * Remove a device
   * TODO: Also invalidate related tokens when Token management is implemented
   */
  async removeDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.userDeviceRepository.findOne({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    // Verify device belongs to the user
    if (device.userId !== userId) {
      throw new NotFoundException('Device not found');
    }

    await this.userDeviceRepository.remove(device);

    // TODO: Invalidate tokens associated with this device
    // This will be implemented when Token management service is available
  }

  /**
   * Find a device by ID and user ID
   */
  async findDeviceById(userId: string, deviceId: string): Promise<UserDevice | null> {
    return this.userDeviceRepository.findOne({
      where: { id: deviceId, userId },
    });
  }

  /**
   * Check if a device is trusted
   */
  async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    const device = await this.findDeviceById(userId, deviceId);
    return device?.trusted ?? false;
  }

  /**
   * Count devices for a user
   */
  async countUserDevices(userId: string): Promise<number> {
    return this.userDeviceRepository.count({
      where: { userId },
    });
  }

  /**
   * Remove all devices for a user (e.g., on account deletion)
   */
  async removeAllUserDevices(userId: string): Promise<void> {
    await this.userDeviceRepository.delete({ userId });
  }

  /**
   * Convert UserDevice entity to DeviceInfo DTO
   */
  private toDeviceInfo(device: UserDevice): DeviceInfo {
    return {
      id: device.id,
      userId: device.userId,
      deviceFingerprint: device.deviceFingerprint,
      deviceName: device.deviceName,
      userAgent: device.userAgent,
      ipAddress: device.ipAddress,
      trusted: device.trusted,
      lastUsedAt: device.lastUsedAt,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    };
  }
}
