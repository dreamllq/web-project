# Backend - NestJS 11 API Server

**Generated:** 2026-03-12 | **Commit:** 51fd327

---

## OVERVIEW

NestJS 11 后端服务，276 个 TypeScript 文件。JWT 认证、RBAC+ABAC 权限、OAuth2、审计日志。

---

## STRUCTURE

```
src/
├── entities/       # ⚠️ 集中式实体层 (非标准 NestJS) - 见 entities/AGENTS.md
├── auth/           # JWT + 2FA + OAuth - 见 auth/AGENTS.md
├── users/          # 多控制器模式 - 见 users/AGENTS.md
├── policy/         # ABAC 核心 (879 行 evaluator) - 见 policy/AGENTS.md
├── oauth/          # OAuth2 服务端 (client/token 管理)
├── rbac/           # 角色权限基础
├── audit/          # 审计日志
├── config/         # 环境配置 (18 文件)
├── api-key/        # API Key 管理
├── websocket/      # WebSocket 网关
├── storage/        # 多存储后端 (local/s3/oss)
├── notification/   # 通知服务
├── mail/           # 邮件服务
├── sms/            # 短信服务
├── file/           # 文件上传
├── i18n/           # 国际化
├── init/           # 初始化模块
├── custom-cache/   # 缓存
└── database/       # 数据库配置
```

---

## WHERE TO LOOK

| 需求          | 位置                                                       |
| ------------- | ---------------------------------------------------------- |
| 模块注册      | `app.module.ts`                                            |
| 数据库实体    | `entities/` (集中式)                                       |
| 认证逻辑      | `auth/auth.service.ts:101-150` (token 生成)                |
| 权限检查      | `policy/policy-evaluator.service.ts`                       |
| OAuth 提供者  | `auth/oauth/` (WeChat, DingTalk)                           |
| OAuth2 服务端 | `oauth/` (client, token)                                   |
| 自定义装饰器  | `auth/decorators/`, `policy/decorators/`                   |
| Guards        | `auth/guards/`, `policy/guards/`                           |
| 配置          | `config/` (database, jwt, mail, storage, wechat, dingtalk) |

---

## CONVENTIONS

### 非标准模式

1. **集中式实体层**: 所有 TypeORM 实体在 `entities/`，非分散在各模块
2. **多控制器模块**: `users/` 有 4 个控制器 (main, device, login-history, avatar)
3. **ABAC 数据过滤**: `@ApplyDataFilter(Entity)` 注入查询条件

### 装饰器组合

```typescript
@Get()
@Public()                              // 跳过认证
@RequirePermission('user', 'read')     // RBAC 检查
@ApplyDataFilter(User)                 // ABAC 数据过滤
@AuditLog('read', 'user')              // 审计日志
findAll() { ... }
```

### 测试模式 (Bun test)

```typescript
import { mock, describe, it, expect, beforeEach } from 'bun:test';

mock.module('bcrypt', () => ({
  hash: mock(async () => 'hashed'),
}));
```

---

## ANTI-PATTERNS

- ❌ 实体写业务逻辑
- ❌ 省略 `nullable: true` (数据库可空字段)
- ❌ `any` 替代具体类型
- ❌ controller 中写业务逻辑
- ❌ 跳过 service 直接访问数据库
- ❌ 硬编码配置值 (用 ConfigService)
- ❌ 绕过 Guard 直接调用 PolicyEvaluatorService

---

## MODULES (17 个)

| 模块         | 职责                        |
| ------------ | --------------------------- |
| auth         | JWT + 2FA + OAuth 提供者    |
| users        | 用户 CRUD + 设备 + 登录历史 |
| policy       | ABAC 权限评估               |
| oauth        | OAuth2 服务端               |
| rbac         | 角色权限基础                |
| audit        | 审计日志                    |
| api-key      | API Key 管理                |
| websocket    | 实时通信                    |
| storage      | 多后端存储                  |
| notification | 通知服务                    |
| mail         | 邮件服务                    |
| sms          | 短信服务                    |
| file         | 文件上传                    |
| i18n         | 国际化                      |
| init         | 初始化                      |
| custom-cache | 缓存                        |

---

## COMMANDS

```bash
pnpm --filter @app/backend dev           # 开发服务器
pnpm --filter @app-backend test          # 运行测试
pnpm --filter @app-backend test:cov      # 覆盖率
pnpm --filter @app-backend migration:run # 数据库迁移
```
