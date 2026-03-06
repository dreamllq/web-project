# AGENTS.md - Centralized Entity Layer

**Generated:** 2026-03-06 | **Commit:** d910024 | 使用中文

---

## OVERVIEW

所有 TypeORM 实体集中存放，统一管理数据库模型定义（非标准 NestJS 模式）。

---

## WHERE TO LOOK

| 领域  | 实体文件                                    | 用途                  |
| ----- | ------------------------------------------- | --------------------- |
| 用户  | `user.entity.ts`                            | 用户核心、2FA、软删除 |
| 认证  | `social-account`, `verification-token`      | 第三方登录、验证令牌  |
| RBAC  | `role`, `permission`, `user-role`           | 角色权限体系          |
| ABAC  | `policy`, `attribute`, `policy-attribute`   | 基于属性的访问控制    |
| OAuth | `oauth-client`, `oauth-token`               | OAuth2 服务端         |
| 审计  | `audit-log`, `login-history`, `user-device` | 日志追踪              |
| 通用  | `file`, `notification`                      | 文件、消息通知        |

---

## CONVENTIONS

### 为什么集中化？

标准 NestJS 实体分散在功能模块，本项目集中化：

- **跨模块引用**：User 被多模块依赖，集中避免循环 import
- **迁移统一**：`pnpm migration:generate` 在同一位置管理
- **类型导出**：`index.ts` barrel，直接 `import { User, Role } from '../entities'`

### TypeORM 装饰器

```typescript
// snake_case 列名，camelCase 属性
@Column({ name: 'password_hash', nullable: true }) passwordHash: string | null;

// 枚举导出复用
export enum UserStatus { ACTIVE = 'active', DISABLED = 'disabled', PENDING = 'pending' }

// JSONB + 时间戳
@Column({ type: 'jsonb' }) conditions: ConditionExpression;
@CreateDateColumn({ name: 'created_at' }) createdAt: Date;
@DeleteDateColumn({ name: 'deleted_at' }) deletedAt: Date | null;

// 关系模式
@OneToMany(() => SocialAccount, (s) => s.user) socialAccounts: SocialAccount[];
@ManyToOne(() => User) @JoinColumn({ name: 'user_id' }) user: User;
@ManyToMany(() => Role) @JoinTable({ name: 'user_roles' }) roles: Role[];
```

---

## ANTI-PATTERNS

**禁止：** 实体写业务逻辑、省略 `nullable: true`、`any` 替代具体类型

**必须：** 新实体加到 `index.ts`、改实体后运行迁移、复合索引用类级 `@Index(['f1', 'f2'])`
