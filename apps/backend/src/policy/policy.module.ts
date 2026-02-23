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
import { CustomCacheModule } from '../custom-cache/custom-cache.module';

@Module({
  imports: [
    DiscoveryModule,
    TypeOrmModule.forFeature([Policy, PolicyAttribute, Attribute, Permission]),
    forwardRef(() => RbacModule),
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
  ],
  exports: [
    PolicyService,
    PolicyEvaluatorService,
    PermissionGuard,
    RoleGuard,
    PermissionCacheService,
    RbacModule, // Re-export RbacModule so consumers get RoleService
  ],
})
export class PolicyModule {}
