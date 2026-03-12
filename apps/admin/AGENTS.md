# Admin - Vue 3 SPA 管理面板

**Generated:** 2026-03-12 | **Commit:** 51fd327

---

## OVERVIEW

管理员 SPA，Vue 3 + Vue Router + Pinia + Element Plus + axios。51 个文件，20 个 views。

---

## STRUCTURE

```
admin/
├── src/
│   ├── views/      # 20 个页面组件 - 见 src/AGENTS.md
│   ├── api/        # 12 个 API 模块 - 见 src/AGENTS.md
│   ├── stores/     # Pinia stores
│   ├── router/     # Vue Router 配置
│   ├── types/      # TypeScript 类型
│   ├── locales/    # i18n (zh-CN, en-US)
│   ├── utils/      # 工具函数
│   ├── layouts/    # 布局组件
│   └── components/ # 通用组件
└── e2e/            # E2E 测试
```

---

## WHERE TO LOOK

| 需求     | 位置                                                                |
| -------- | ------------------------------------------------------------------- |
| 页面组件 | `src/views/` (Users, Roles, Permissions, Policies, etc.)            |
| API 模块 | `src/api/` (user, role, permission, policy, audit-log, oauth, etc.) |
| 错误处理 | `src/api/index.ts` → `extractApiError()`                            |
| 路由配置 | `src/router/`                                                       |
| 认证状态 | `src/stores/auth.ts`                                                |
| 类型定义 | `src/types/`                                                        |

---

## VIEWS (20 个)

| 页面         | 文件                        |
| ------------ | --------------------------- |
| 用户管理     | `Users.vue`                 |
| 角色管理     | `Roles.vue`                 |
| 权限管理     | `Permissions.vue`           |
| 策略管理     | `Policies.vue`              |
| 审计日志     | `AuditLogs.vue`             |
| OAuth 客户端 | `OAuthClients.vue`          |
| OAuth Token  | `OAuthTokens.vue`           |
| OAuth 提供者 | `OAuthProviderSettings.vue` |
| 社交账号     | `SocialAccounts.vue`        |
| API Keys     | `APIKeys.vue`               |
| 登录历史     | `LoginHistory.vue`          |
| 设备管理     | `DeviceManagement.vue`      |
| 个人资料     | `Profile.vue`               |
| 2FA 设置     | `TwoFactorSettings.vue`     |
| 修改密码     | `ChangePassword.vue`        |
| 重置密码     | `ResetPassword.vue`         |
| 手机验证     | `PhoneVerification.vue`     |
| 登录         | `Login.vue`                 |
| 忘记密码     | `ForgotPassword.vue`        |
| 首页         | `Home.vue`                  |

---

## API MODULES (12 个)

| 模块     | 文件                                              |
| -------- | ------------------------------------------------- |
| 用户     | `user.ts`, `admin-user.ts`                        |
| 角色     | `role.ts`                                         |
| 权限     | `permission.ts`                                   |
| 策略     | `policy.ts`                                       |
| 审计日志 | `audit-log.ts`                                    |
| OAuth    | `oauth.ts`, `oauth-provider.ts`, `oauth-token.ts` |
| 社交账号 | `social-account.ts`                               |
| API Key  | `api-key.ts`                                      |

---

## CONVENTIONS

### API 错误处理 (必须遵循)

```typescript
import api, { extractApiError } from '@/api';

try {
  await api.post('/users', data);
  ElMessage.success('创建成功');
} catch (error: unknown) {
  const apiError = extractApiError(error);
  ElMessage.error(apiError.displayMessage); // "[400] 用户名已存在"
}
```

### Token 存储

- **使用** `localStorage` (非 SSR)
- **禁止** `useCookie`

### 401 处理

- 自动刷新 token
- 刷新失败则跳转登录

---

## ANTI-PATTERNS

- ❌ 直接 `axios`/`fetch` - 用 `@/api` 模块
- ❌ `catch` 不显示错误 - 用 `extractApiError()` + `ElMessage.error()`
- ❌ 使用 `useCookie` - 用 `localStorage`

---

## 与 Portal 差异

| 特性  | Admin           | Portal    |
| ----- | --------------- | --------- |
| HTTP  | axios           | $fetch    |
| Token | localStorage    | useCookie |
| 路由  | 显式 Vue Router | 文件路由  |
| 错误  | extractApiError | 抛出      |
| SSR   | ❌              | ✅        |

---

## COMMANDS

```bash
pnpm --filter @app/admin dev    # 开发服务器 (port 3002)
pnpm --filter @app/admin build  # 构建
```
