import { Controller, Get, Query, UseGuards, Version, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from './storage.service';
import type { SignedUrlResponse } from '../common/types/storage-url.dto';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Get a signed URL for accessing a private file
   * GET /api/v1/storage/signed-url?key=xxx
   */
  @Get('signed-url')
  @Version('1')
  async getSignedUrl(@Query('key') key: string): Promise<SignedUrlResponse> {
    if (!key) {
      throw new BadRequestException('key parameter is required');
    }

    // Signed URL expiration time (7 days in seconds)
    const SIGNED_URL_EXPIRES_IN = 7 * 24 * 60 * 60;

    const url = await this.storageService.getSignedUrl(key, SIGNED_URL_EXPIRES_IN);
    return { url };
  }
}
