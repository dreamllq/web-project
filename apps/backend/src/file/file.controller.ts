import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { FileService } from './file.service';
import { QueryFileDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';
import { File as FileEntity } from '../entities/file.entity';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FileController {
  constructor(private readonly fileService: FileService) {}

  /**
   * Upload a file
   * POST /api/files/upload
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const allowedMimes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
        ];
        if (!allowedMimes.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              `Invalid file type. Allowed types: ${allowedMimes.join(', ')}`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @CurrentUser() user: User,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<FileEntity> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.fileService.upload(user.id, file);
  }

  /**
   * List all files for the current user
   * GET /api/files
   */
  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query() query: QueryFileDto,
  ): Promise<{ data: FileEntity[]; total: number; page: number; limit: number }> {
    const { data, total } = await this.fileService.findAll(user.id, query);
    return {
      data,
      total,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    };
  }

  /**
   * Get file metadata by ID
   * GET /api/files/:id
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<FileEntity> {
    return this.fileService.findOne(user.id, id);
  }

  /**
   * Download a file by ID
   * GET /api/files/:id/download
   */
  @Get(':id/download')
  async download(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.fileService.findOne(user.id, id);
    const filePath = await this.fileService.getFilePath(file);

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);

    const fileStream = createReadStream(filePath);
    fileStream.pipe(res);
  }

  /**
   * Delete a file
   * DELETE /api/files/:id
   */
  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.fileService.delete(user.id, id);
    return { success: true };
  }
}
