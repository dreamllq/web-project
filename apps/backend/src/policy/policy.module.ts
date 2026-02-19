import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Policy } from '../entities/policy.entity';
import { PolicyAttribute } from '../entities/policy-attribute.entity';
import { PolicyPermission } from '../entities/policy-permission.entity';
import { Attribute } from '../entities/attribute.entity';
import { Permission } from '../entities/permission.entity';
import { PolicyService } from './policy.service';
import { PolicyEvaluatorService } from './policy-evaluator.service';
import { PolicyController } from './policy.controller';
import { RbacModule } from '../rbac/rbac.module';
import { PermissionGuard } from './guards/permission.guard';
import { RoleGuard } from './guards/role.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Policy, PolicyAttribute, PolicyPermission, Attribute, Permission]),
    forwardRef(() => RbacModule),
  ],
  controllers: [PolicyController],
  providers: [PolicyService, PolicyEvaluatorService, PermissionGuard, RoleGuard],
  exports: [
    PolicyService,
    PolicyEvaluatorService,
    PermissionGuard,
    RoleGuard,
    RbacModule, // Re-export RbacModule so consumers get RoleService
  ],
})
export class PolicyModule {}
