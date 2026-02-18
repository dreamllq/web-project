import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Version,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { UserDeviceService, DeviceInfo } from '../services/user-device.service';
import { TrustDeviceDto, RemoveDeviceDto } from '../dto';

/**
 * Device response interface
 */
export interface DeviceResponse {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  trusted: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}

/**
 * Device list response interface
 */
export interface DeviceListResponse {
  data: DeviceResponse[];
}

/**
 * Trust device response interface
 */
export interface TrustDeviceResponse {
  success: boolean;
  message: string;
  device: DeviceResponse;
}

/**
 * Device Management Controller
 *
 * Handles user device management operations:
 * - List all registered devices
 * - Trust a device
 * - Remove a device
 *
 * All endpoints require JWT authentication.
 * Users can only manage their own devices.
 */
@Controller('users/me/devices')
@UseGuards(JwtAuthGuard)
export class DeviceController {
  constructor(private readonly userDeviceService: UserDeviceService) {}

  /**
   * Get all devices for the current user
   * GET /api/v1/users/me/devices
   */
  @Get()
  @Version('1')
  async getDevices(@CurrentUser() user: User): Promise<DeviceListResponse> {
    const devices = await this.userDeviceService.getUserDevices(user.id);
    return {
      data: devices.map((device) => this.toDeviceResponse(device)),
    };
  }

  /**
   * Trust a device
   * POST /api/v1/users/me/devices/:deviceId/trust
   */
  @Post(':deviceId/trust')
  @Version('1')
  async trustDevice(
    @CurrentUser() user: User,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() _trustDeviceDto: TrustDeviceDto
  ): Promise<TrustDeviceResponse> {
    const device = await this.userDeviceService.trustDevice(user.id, deviceId);
    return {
      success: true,
      message: 'Device trusted',
      device: this.toDeviceResponse(device),
    };
  }

  /**
   * Remove a device
   * DELETE /api/v1/users/me/devices/:deviceId
   */
  @Delete(':deviceId')
  @Version('1')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeDevice(
    @CurrentUser() user: User,
    @Param('deviceId', ParseUUIDPipe) deviceId: string,
    @Body() _removeDeviceDto: RemoveDeviceDto
  ): Promise<void> {
    await this.userDeviceService.removeDevice(user.id, deviceId);
  }

  /**
   * Transform DeviceInfo to DeviceResponse
   * Excludes sensitive fields like deviceFingerprint and userId
   */
  private toDeviceResponse(device: DeviceInfo): DeviceResponse {
    return {
      id: device.id,
      deviceName: device.deviceName,
      userAgent: device.userAgent,
      ipAddress: device.ipAddress,
      trusted: device.trusted,
      lastUsedAt: device.lastUsedAt,
      createdAt: device.createdAt,
    };
  }
}
