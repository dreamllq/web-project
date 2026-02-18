import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleService } from './role.service';
import { PermissionService } from './permission.service';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Role, Permission, UserRole, User])],
  providers: [RoleService, PermissionService],
  exports: [RoleService, PermissionService],
})
export class RbacModule {}
