import { Module, forwardRef } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Policy } from '../entities/policy.entity';
import { PolicyAttribute } from '../entities/policy-attribute.entity';
import { Attribute } from '../entities/attribute.entity';
import { Permission } from '../entities/permission.entity';
import { PolicyService } from './policy.service';
import { PolicyEvaluatorService } from './policy-evaluator.service';
import { PolicyController } from './policy.controller';
import { RbacModule } from '../rbac/rbac.module';
import { PermissionGuard } from './guards/permission.guard';
import { RoleGuard } from './guards/role.guard';
import { PermissionSyncService } from './services/permission-sync.service';
import { PermissionCacheService } from './services/permission-cache.service';
import { SubjectTypeRegistryService } from './services/subject-type-registry.service';
import { CustomCacheModule } from '../custom-cache/custom-cache.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    DiscoveryModule,
    TypeOrmModule.forFeature([Policy, PolicyAttribute, Attribute, Permission]),
    forwardRef(() => RbacModule),
    forwardRef(() => UsersModule),
    CustomCacheModule,
  ],
  controllers: [PolicyController],
  providers: [
    PolicyService,
    PolicyEvaluatorService,
    PermissionGuard,
    RoleGuard,
    PermissionSyncService,
    PermissionCacheService,
    SubjectTypeRegistryService,
  ],
  exports: [
    PolicyService,
    PolicyEvaluatorService,
    PermissionGuard,
    RoleGuard,
    PermissionCacheService,
    SubjectTypeRegistryService,
    RbacModule, // Re-export RbacModule so consumers get RoleService
  ],
})
export class PolicyModule {}
