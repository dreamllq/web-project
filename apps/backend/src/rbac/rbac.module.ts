import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleService } from './role.service';
import { PermissionService } from './permission.service';
import { RbacController } from './rbac.controller';
import { PermissionController } from './permission.controller';
import { Role } from '../entities/role.entity';
import { Permission } from '../entities/permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { PolicyPermission } from '../entities/policy-permission.entity';
import { Policy } from '../entities/policy.entity';
import { PolicyModule } from '../policy/policy.module';
import { PermissionMigrationService } from './permission-migration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Role,
      Permission,
      UserRole,
      User,
      RolePermission,
      PolicyPermission,
      Policy,
    ]),
    forwardRef(() => PolicyModule),
  ],
  controllers: [RbacController, PermissionController],
  providers: [RoleService, PermissionService, PermissionMigrationService],
  exports: [RoleService, PermissionService, PermissionMigrationService],
})
export class RbacModule {}
