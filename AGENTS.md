# AGENTS.md - AI Agent Code Generation Guide

**Generated:** 2026-03-12 | **Commit:** 51fd327 | **Branch:** main

**Language:** 使用中文回复

---

## 1. 项目概述

**Monorepo** (pnpm workspaces) - 486 文件, 69K 行代码, 3 应用 + 2 共享包

| App            | Description            | Framework      | Port | 文件 |
| -------------- | ---------------------- | -------------- | ---- | ---- |
| `apps/backend` | NestJS API server      | NestJS 11      | 3000 | 276  |
| `apps/portal`  | User-facing web app    | Nuxt 3 / Vue 3 | 3001 | 20   |
| `apps/admin`   | Admin management panel | Vue 3 SPA      | 3002 | 51   |

| Package           | 用途                     |
| ----------------- | ------------------------ |
| `packages/shared` | 共享 locales (i18n)      |
| `packages/types`  | 共享 TypeScript 类型定义 |

---

## 2. 常用命令

### 根目录命令

```bash
pnpm lint          # 检查所有代码
pnpm lint:fix      # 自动修复 lint 问题
pnpm format        # 格式化代码
```

### Backend (apps/backend)

```bash
pnpm --filter @app/backend dev           # 启动开发服务器
pnpm --filter @app/backend build         # 构建
pnpm --filter @app-backend test          # 运行所有测试
pnpm --filter @app-backend test:watch    # 监听模式
pnpm --filter @app-backend test:cov      # 覆盖率报告

# 运行单个测试文件
pnpm --filter @app-backend test -- src/auth/auth.service.spec.ts

# 运行匹配名称的测试
pnpm --filter @app-backend test -- --testNamePattern="should hash password"

# 数据库迁移
pnpm --filter @app-backend migration:generate -- -n <Name>
pnpm --filter @app-backend migration:run
pnpm --filter @app-backend migration:revert
```

### Frontend

```bash
pnpm --filter @app/portal dev    # Portal (Nuxt 3)
pnpm --filter @app/admin dev     # Admin (Vite)
pnpm --filter @app/portal build  # 构建 Portal
pnpm --filter @app/admin build   # 构建 Admin
```

---

## 3. 代码风格 (Prettier)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

---

## 4. 命名规范

| Type        | Convention              | Example           |
| ----------- | ----------------------- | ----------------- |
| 组件文件    | PascalCase              | `UserAvatar.vue`  |
| Composables | camelCase + use 前缀    | `useAuth.ts`      |
| Stores      | camelCase               | `auth.ts`         |
| DTOs        | kebab-case              | `register.dto.ts` |
| 类/接口     | PascalCase              | `UsersService`    |
| 变量        | camelCase               | `currentUser`     |
| 常量        | UPPER_SNAKE_CASE        | `IS_PUBLIC_KEY`   |
| 数据库字段  | snake_case              | `password_hash`   |
| 类型后缀    | Dto/Response/Data/Query | `RegisterDto`     |

---

## 5. 后端约定 (NestJS)

### 模块结构

```
feature/
├── dto/                    # 数据传输对象
├── feature.module.ts
├── feature.service.ts
├── feature.controller.ts
└── *.spec.ts               # 测试文件
```

### 常用装饰器

| 装饰器                               | 用途          |
| ------------------------------------ | ------------- |
| `@Public()`                          | 跳过 JWT 认证 |
| `@CurrentUser()`                     | 注入当前用户  |
| `@RequirePermission('user', 'read')` | 权限控制      |
| `@AuditLog('create', 'user')`        | 审计日志      |

### 错误处理

```typescript
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

throw new ConflictException('Username already exists');
throw new NotFoundException('User not found');
throw new BadRequestException('Invalid input data');
```

### 测试模式 (Bun test)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { mock, describe, it, expect, beforeEach } from 'bun:test';

mock.module('bcrypt', () => ({
  hash: mock(async () => 'hashed_password'),
}));

describe('MyService', () => {
  const mockRepo = { find: mock(), save: mock() };

  beforeEach(() => {
    mockRepo.find.mockClear();
  });

  it('should work', async () => {
    mockRepo.find.mockResolvedValue([{ id: '1' }]);
    // ...
  });
});
```

---

## 6. 前端约定 (Vue 3)

### Portal vs Admin 关键差异

| Feature        | Portal (Nuxt 3)        | Admin (Vue 3 SPA)   |
| -------------- | ---------------------- | ------------------- |
| HTTP Client    | `$fetch`               | `axios`             |
| Token Storage  | `useCookie` (SSR-safe) | `localStorage`      |
| Auto-imports   | 是                     | 否 (显式 import)    |
| Token Refresh  | 自动刷新               | 401 直接登出        |
| Error Handling | 抛给调用者             | `extractApiError()` |

### 组件模板

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';

interface Props {
  title: string;
}

const props = withDefaults(defineProps<Props>(), { title: '' });
const emit = defineEmits<{ (e: 'update', value: string): void }>();
</script>
```

### API 调用

```typescript
// Portal: useApi composable
const api = useApi();
const data = await api.get<User>('/users/me');

// Admin: axios + extractApiError
import api, { extractApiError } from '@/api';
try {
  await api.post('/users', formData);
} catch (error) {
  ElMessage.error(extractApiError(error).displayMessage);
}
```

---

## 7. TypeScript 规范

- 用 **interface** 定义可扩展的对象类型
- 用 **type** 定义联合类型、交叉类型
- 数据库可空字段用 `string | null`
- 可选输入参数用 `?:`

---

## 8. 禁止事项

### 通用

- **禁止** `var`
- **禁止** `any` (除非有注释说明)
- **禁止** `console.log` (用 Logger)

### Backend

- **禁止** controller 中写业务逻辑
- **禁止** 硬编码配置值 (用 ConfigService)
- **禁止** 跳过 service 直接访问数据库

### Frontend

- **禁止** Portal 中使用 `localStorage` (用 `useCookie`)
- **禁止** 组件中直接调用 `fetch`/`axios` (用 composables)
- **禁止** 直接操作 DOM (用 Vue refs)
- **禁止** Portal setup 中使用 `window`/`document` (用 `onMounted`)

### Admin

- **禁止** 自动刷新 token (401 直接登出)

---

## 9. 参考文件

| 文件                                         | 用途                  |
| -------------------------------------------- | --------------------- |
| `apps/backend/src/auth/dto/register.dto.ts`  | DTO + class-validator |
| `apps/backend/src/users/users.service.ts`    | Service 模式          |
| `apps/backend/src/users/users.controller.ts` | Controller + Guards   |
| `apps/portal/composables/useApi.ts`          | Portal API 封装       |
| `apps/portal/stores/auth.ts`                 | Pinia + useCookie     |
| `apps/admin/src/api/index.ts`                | Admin axios 封装      |
