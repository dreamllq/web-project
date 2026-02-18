import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { SocialAccount } from '../entities/social-account.entity';
import { LoginHistory } from '../entities/login-history.entity';
import { UserDevice } from '../entities/user-device.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { LoginHistoryService } from './services/login-history.service';
import { LoginHistoryController } from './controllers/login-history.controller';
import { AvatarController } from './controllers/avatar.controller';
import { DeviceController } from './controllers/device.controller';
import { UserDeviceService } from './services/user-device.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, SocialAccount, LoginHistory, UserDevice]),
    StorageModule,
  ],
  controllers: [UsersController, LoginHistoryController, AvatarController, DeviceController],
  providers: [UsersService, LoginHistoryService, UserDeviceService],
  exports: [UsersService, LoginHistoryService, UserDeviceService],
})
export class UsersModule {}
