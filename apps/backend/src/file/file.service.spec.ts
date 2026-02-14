// Mock fs/promises before any imports
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  access: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 1024, birthtime: new Date() }),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { FileService } from './file.service';
import { File, StorageProvider } from '../entities/file.entity';
import { User, UserStatus } from '../entities/user.entity';

describe('FileService', () => {
  let service: FileService;

  const mockUser: User = {
    id: 'user-uuid',
    username: 'testuser',
    email: 'test@example.com',
    phone: null,
    passwordHash: 'hashed',
    nickname: null,
    avatarUrl: null,
    status: UserStatus.ACTIVE,
    locale: 'zh-CN',
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    socialAccounts: [],
    notifications: [],
    files: [],
    oauthTokens: [],
  };

  const mockFile: File = {
    id: 'file-uuid',
    userId: 'user-uuid',
    filename: 'test-image.png',
    storedName: 'stored-uuid.png',
    mimeType: 'image/png',
    size: 1024,
    storageProvider: StorageProvider.LOCAL,
    storagePath: '/uploads/stored-uuid.png',
    url: '/api/files/stored-uuid/download',
    createdAt: new Date(),
    user: mockUser,
  };

  const mockStorageConfig = {
    uploadDir: '/uploads',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ],
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    remove: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue(mockStorageConfig),
  };

  const mockMulterFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test-image.png',
    encoding: '7bit',
    mimetype: 'image/png',
    buffer: Buffer.from('test file content'),
    size: 1024,
    destination: '',
    filename: 'test-image.png',
    path: '',
    stream: {} as never,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        {
          provide: getRepositoryToken(File),
          useValue: mockRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('should upload a file successfully', async () => {
      mockRepository.create.mockReturnValue(mockFile);
      mockRepository.save.mockResolvedValue(mockFile);

      const result = await service.upload('user-uuid', mockMulterFile);

      expect(result).toEqual(mockFile);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for file exceeding size limit', async () => {
      const largeFile: Express.Multer.File = {
        ...mockMulterFile,
        size: 20 * 1024 * 1024, // 20MB
      };

      await expect(service.upload('user-uuid', largeFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for invalid MIME type', async () => {
      const invalidFile: Express.Multer.File = {
        ...mockMulterFile,
        mimetype: 'application/exe',
      };

      await expect(service.upload('user-uuid', invalidFile)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated files for a user', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockFile], 1]);

      const result = await service.findAll('user-uuid', {});

      expect(result).toEqual({ data: [mockFile], total: 1 });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        order: { createdAt: 'DESC' },
        skip: 0,
        take: 20,
      });
    });

    it('should filter by MIME type', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockFile], 1]);

      await service.findAll('user-uuid', { mimeType: 'image' });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            mimeType: expect.anything(),
          }),
        }),
      );
    });

    it('should apply pagination correctly', async () => {
      mockRepository.findAndCount.mockResolvedValue([[mockFile], 50]);

      const result = await service.findAll('user-uuid', { page: 2, limit: 10 });

      expect(result).toEqual({ data: [mockFile], total: 50 });
      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        order: { createdAt: 'DESC' },
        skip: 10,
        take: 10,
      });
    });
  });

  describe('findOne', () => {
    it('should return a file by ID for the user', async () => {
      mockRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.findOne('user-uuid', 'file-uuid');

      expect(result).toEqual(mockFile);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'file-uuid', userId: 'user-uuid' },
      });
    });

    it('should throw NotFoundException if file not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('user-uuid', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByStoredName', () => {
    it('should return a file by stored name', async () => {
      mockRepository.findOne.mockResolvedValue(mockFile);

      const result = await service.findByStoredName('stored-uuid.png');

      expect(result).toEqual(mockFile);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { storedName: 'stored-uuid.png' },
      });
    });

    it('should throw NotFoundException if file not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findByStoredName('non-existent.png'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      mockRepository.findOne.mockResolvedValue(mockFile);
      mockRepository.remove.mockResolvedValue(mockFile);

      await service.delete('user-uuid', 'file-uuid');

      expect(mockRepository.remove).toHaveBeenCalledWith(mockFile);
    });

    it('should throw NotFoundException if file not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.delete('user-uuid', 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user does not own the file', async () => {
      const otherUserFile = { ...mockFile, userId: 'other-user-uuid' };
      mockRepository.findOne.mockResolvedValue(otherUserFile);

      await expect(
        service.delete('user-uuid', 'file-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getFilePath', () => {
    it('should return file path', async () => {
      const result = await service.getFilePath(mockFile);

      expect(result).toBe(mockFile.storagePath);
    });
  });

  describe('getFileStats', () => {
    it('should return file stats', async () => {
      const result = await service.getFileStats(mockFile);

      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('createdAt');
    });
  });
});
