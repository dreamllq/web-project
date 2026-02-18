import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  Version,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { User } from '../../entities/user.entity';
import { StorageService } from '../../storage/storage.service';
import { UsersService } from '../users.service';
import sharp from 'sharp';

// Allowed MIME types for avatar upload
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Max file size: 2MB
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// Avatar dimensions
const AVATAR_SIZE = 256;

/**
 * Custom file filter for MIME type validation
 */
const avatarFileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void
) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(
      new BadRequestException(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`),
      false
    );
  }
  callback(null, true);
};

export interface AvatarUploadResponse {
  success: boolean;
  avatarUrl: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class AvatarController {
  constructor(
    private readonly storageService: StorageService,
    private readonly usersService: UsersService
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
      fileFilter: avatarFileFilter,
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
    })
  )
  async uploadAvatar(
    @CurrentUser() user: User,
    file: Express.Multer.File
  ): Promise<AvatarUploadResponse> {
    // Validate file exists
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Additional size check (multer might not catch edge cases)
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(`File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`);
    }

    try {
      // Process image with sharp
      // - Resize to 256x256 with cover fit (will crop to square)
      // - Convert to WebP format for consistency and smaller file size
      // - Set quality to 80 for good balance between quality and size
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

      // Update user's avatarUrl
      await this.usersService.updateAvatarUrl(user.id, uploadResult.url);

      return {
        success: true,
        avatarUrl: uploadResult.url,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Failed to process or upload avatar');
    }
  }
}
