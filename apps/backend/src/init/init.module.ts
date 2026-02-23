import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscoveryModule } from '@nestjs/core';
import { InitService } from './init.service';
import { InitAccountSyncService } from './services/init-account-sync.service';
import { InitAccountConfig } from './config/init-account.config';
import { UsersModule } from '../users/users.module';
import { PolicyModule } from '../policy/policy.module';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

@Module({
  imports: [
    DiscoveryModule,
    TypeOrmModule.forFeature([User, Role]),
    forwardRef(() => UsersModule),
    forwardRef(() => PolicyModule),
  ],
  controllers: [],
  providers: [InitService, InitAccountSyncService, InitAccountConfig],
  exports: [InitService, InitAccountSyncService],
})
export class InitModule {}
