import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Version,
  UploadedFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { StorageService } from '../../storage/storage.service';
import { UsersService } from '../users.service';
import type { StorageUrlResponse } from '../../common/types/storage-url.dto';
import type { MultiStorageConfig } from '../../config/storage.config';
import sharp from 'sharp';

// Max file size: 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Avatar dimensions
const AVATAR_SIZE = 256;

export interface AvatarUploadResponse {
  success: boolean;
  avatar: StorageUrlResponse;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class AvatarController {
  constructor(
    private readonly storageService: StorageService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Upload avatar
   * POST /api/v1/users/me/avatar
   * Content-Type: multipart/form-data
   * Body: file (image file)
   */
  @Post('me/avatar')
  @Version('1')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
    })
  )
  async uploadAvatar(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File
  ): Promise<AvatarUploadResponse> {
    // Validate file exists
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    // Additional size check (multer might not catch edge cases)
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    try {
      // Process image with sharp
      const processedBuffer = await sharp(file.buffer)
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();

      // Generate unique key for storage
      const timestamp = Date.now();
      const key = `avatars/${user.id}/${timestamp}.webp`;

      // Upload to storage service
      const uploadResult = await this.storageService.upload(key, processedBuffer, {
        contentType: 'image/webp',
        metadata: {
          userId: user.id,
          originalFilename: file.originalname,
        },
      });

      // Get storage config to determine provider type
      const storageConfig = this.configService.get<MultiStorageConfig>('storage');
      const storageType = storageConfig?.provider ?? 'local';

      let avatar: StorageUrlResponse;

      if (storageType === 'local') {
        // For local storage, store and return the direct URL
        await this.usersService.updateAvatarUrl(user.id, uploadResult.url);
        avatar = { type: 'local', url: uploadResult.url };
      } else {
        // For S3/MinIO, store the KEY (not signed URL) and return key for frontend to fetch signed URL
        await this.usersService.updateAvatarUrl(user.id, key);
        avatar = { type: storageType, key };
      }

      return {
        success: true,
        avatar,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to process or upload avatar');
    }
  }
}
