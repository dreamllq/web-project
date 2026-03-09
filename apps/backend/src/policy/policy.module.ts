import { Module, forwardRef, OnModuleInit, Logger } from '@nestjs/common';
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
import { OAuthPermissionsSeed } from './seeds/oauth-permissions.seed';

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
    OAuthPermissionsSeed,
  ],
  exports: [
    PolicyService,
    PolicyEvaluatorService,
    PermissionGuard,
    RoleGuard,
    PermissionCacheService,
    SubjectTypeRegistryService,
    RbacModule,
  ],
})
export class PolicyModule implements OnModuleInit {
  private readonly logger = new Logger(PolicyModule.name);

  constructor(private readonly oauthPermissionsSeed: OAuthPermissionsSeed) {}

  async onModuleInit() {
    try {
      await this.oauthPermissionsSeed.seed();
    } catch (error) {
      this.logger.error('Failed to seed OAuth permissions', error);
    }
  }
}
