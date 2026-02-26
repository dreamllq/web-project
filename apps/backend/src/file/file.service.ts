import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like } from 'typeorm';
import { ConfigService } from '@nestjs/config';

import * as path from 'path';
import { randomUUID } from 'crypto';
import { File, StorageProvider } from '../entities/file.entity';
import { QueryFileDto } from './dto';
import { FileConfig } from './config/file.config';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class FileService {
  private readonly allowedMimeTypes: string[];
  private readonly maxFileSize: number;

  constructor(
    @InjectRepository(File)
    private readonly fileRepo: Repository<File>,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
  ) {
    const fileConfig = this.configService.get<FileConfig>('file')!;
    this.allowedMimeTypes = fileConfig.allowedMimeTypes;
    this.maxFileSize = fileConfig.maxFileSize;
  }


  /**
   * Upload a file
   */
  async upload(userId: string, file: Express.Multer.File): Promise<File> {
    // Validate file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(
        `File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`
      );
    }

    // Validate MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed. Allowed types: ${this.allowedMimeTypes.join(', ')}`
      );
    }
    // Generate storage key and upload via storage service
    const ext = path.extname(file.originalname);
    const storedName = `${randomUUID()}${ext}`;
    const storageKey = `files/${storedName}`;

    // Upload via storage service
    const result = await this.storageService.upload(storageKey, file.buffer, {
      contentType: file.mimetype,
    });

    // Create file record
    const fileRecord = this.fileRepo.create({
      userId,
      filename: file.originalname,
      storedName,
      mimeType: file.mimetype,
      size: file.size,
      storageProvider: StorageProvider.LOCAL,
      storagePath: result.key,
      url: result.url,
    });

    return this.fileRepo.save(fileRecord);
  }

  /**
   * Find all files for a user with filtering and pagination
   */
  async findAll(userId: string, query: QueryFileDto): Promise<{ data: File[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<File> = { userId };

    if (query.mimeType) {
      where.mimeType = Like(`${query.mimeType}%`);
    }

    const [data, total] = await this.fileRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }

  /**
   * Find a single file by ID for a specific user
   */
  async findOne(userId: string, id: string): Promise<File> {
    const file = await this.fileRepo.findOne({
      where: { id, userId },
    });

    if (!file) {
      throw new NotFoundException(`File with ID "${id}" not found`);
    }

    return file;
  }

  /**
   * Find a file by stored name (for download)
   */
  async findByStoredName(storedName: string): Promise<File> {
    const file = await this.fileRepo.findOne({
      where: { storedName },
    });

    if (!file) {
      throw new NotFoundException(`File not found`);
    }

    return file;
  }

  /**
   * Delete a file
   */
  async delete(userId: string, id: string): Promise<void> {
    const file = await this.findOne(userId, id);

    // Verify ownership
    if (file.userId !== userId) {
      throw new ForbiddenException('You do not have access to this file');
    }

    // Delete file from storage
    try {
      await this.storageService.delete(file.storagePath);
    } catch {
      // File might not exist in storage, continue with database deletion
    }

    // Delete from database
    await this.fileRepo.remove(file);
  }

  /**
   * Get a signed download URL for a file
   */
  async getDownloadUrl(file: File): Promise<string> {
    return this.storageService.getSignedUrl(file.storagePath);
  }

}
