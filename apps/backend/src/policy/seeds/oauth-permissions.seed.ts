import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../../entities/permission.entity';

export interface SeedResult {
  inserted: number;
  skipped: number;
}

export interface PermissionDefinition {
  name: string;
  resource: string;
  action: string;
  description: string;
}

@Injectable()
export class OAuthPermissionsSeed {
  private readonly logger = new Logger(OAuthPermissionsSeed.name);

  constructor(
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>
  ) {}

  getDefinedPermissions(): PermissionDefinition[] {
    return [
      {
        name: 'oauth-provider:read',
        resource: 'oauth-provider',
        action: 'read',
        description: '查看 OAuth 提供商',
      },
      {
        name: 'oauth-provider:create',
        resource: 'oauth-provider',
        action: 'create',
        description: '创建 OAuth 提供商',
      },
      {
        name: 'oauth-provider:update',
        resource: 'oauth-provider',
        action: 'update',
        description: '更新 OAuth 提供商',
      },
      {
        name: 'oauth-provider:delete',
        resource: 'oauth-provider',
        action: 'delete',
        description: '删除 OAuth 提供商',
      },
      {
        name: 'oauth-provider:test',
        resource: 'oauth-provider',
        action: 'test',
        description: '测试 OAuth 提供商配置',
      },
      {
        name: 'oauth-client:read',
        resource: 'oauth-client',
        action: 'read',
        description: '查看 OAuth 客户端',
      },
      {
        name: 'oauth-client:create',
        resource: 'oauth-client',
        action: 'create',
        description: '创建 OAuth 客户端',
      },
      {
        name: 'oauth-client:update',
        resource: 'oauth-client',
        action: 'update',
        description: '更新 OAuth 客户端',
      },
      {
        name: 'oauth-client:delete',
        resource: 'oauth-client',
        action: 'delete',
        description: '删除 OAuth 客户端',
      },
      {
        name: 'oauth-client:regenerate_secret',
        resource: 'oauth-client',
        action: 'regenerate_secret',
        description: '重新生成 OAuth 客户端密钥',
      },
      {
        name: 'oauth-token:read',
        resource: 'oauth-token',
        action: 'read',
        description: '查看 OAuth 令牌',
      },
      {
        name: 'oauth-token:delete',
        resource: 'oauth-token',
        action: 'delete',
        description: '撤销 OAuth 令牌',
      },
      {
        name: 'social-account:read',
        resource: 'social-account',
        action: 'read',
        description: '查看社交账号',
      },
      {
        name: 'social-account:delete',
        resource: 'social-account',
        action: 'delete',
        description: '解绑社交账号',
      },
    ];
  }

  async seed(): Promise<SeedResult> {
    const permissions = this.getDefinedPermissions();
    let inserted = 0;
    let skipped = 0;

    for (const permissionData of permissions) {
      const existing = await this.permissionRepository.findOne({
        where: { name: permissionData.name },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const permission = this.permissionRepository.create(permissionData);
      await this.permissionRepository.save(permission);
      inserted++;
    }

    this.logger.log(`OAuth permissions seed completed: ${inserted} inserted, ${skipped} skipped`);

    return { inserted, skipped };
  }
}
