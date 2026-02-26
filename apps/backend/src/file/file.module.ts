import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { File } from '../entities/file.entity';
import { FileService } from './file.service';
import { FileController } from './file.controller';
import { fileConfig } from './config/file.config';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([File]),
    ConfigModule.forFeature(fileConfig),
    StorageModule,
  ],
  controllers: [FileController],
  providers: [FileService],
  exports: [FileService],
})
export class FileModule {}
