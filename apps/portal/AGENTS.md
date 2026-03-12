# Portal - Nuxt 3 / Vue 3 SSR 应用

**Generated:** 2026-03-12 | **Commit:** 51fd327

---

## OVERVIEW

用户端 SSR 应用，Nuxt 3 + Vue 3 + Pinia + Element Plus。20 个文件，2 个 composables。

---

## STRUCTURE

```
portal/
├── composables/    # useApi, useAuth - 见 composables/AGENTS.md
├── stores/         # Pinia: auth.ts
├── pages/          # 文件路由: auth/, profile/, docs/
├── middleware/     # 路由中间件
├── plugins/        # Nuxt 插件
├── layouts/        # 布局组件
├── components/     # Vue 组件
├── locales/        # i18n 文件
├── server/         # 服务端代码
├── public/         # 静态资源
└── nuxt.config.ts  # Nuxt 配置
```

---

## WHERE TO LOOK

| 需求         | 位置                                        |
| ------------ | ------------------------------------------- |
| API 调用     | `composables/useApi.ts` (自动刷新 token)    |
| 认证状态     | `stores/auth.ts` + `composables/useAuth.ts` |
| 路由页面     | `pages/` (文件路由)                         |
| 路由守卫     | `middleware/`                               |
| Nuxt 配置    | `nuxt.config.ts`                            |
| API Base URL | `runtimeConfig.public.apiBase`              |

---

## CONVENTIONS

### SSR 安全 (关键)

```typescript
// ✓ 正确 - SSR 安全
if (import.meta.client) {
  navigateTo('/login');
}

// ✗ 错误 - 服务端崩溃
window.location.href = '/login';
```

### Token 存储

- **必须** 使用 `useCookie` (SSR 安全)
- **禁止** `localStorage` / `sessionStorage`

### API 调用

```typescript
const api = useApi();
const data = await api.get<User>('/users/me');
```

### Token 刷新

- `useApi.ts` 自动处理 401
- 请求队列在刷新期间排队
- 刷新失败后跳转登录

### 错误处理

Composables 抛出错误，由调用者处理 UI：

```typescript
// ✓ 组件处理 UI
try {
  await login(credentials);
} catch (error) {
  ElMessage.error(error.message);
}
```

---

## ANTI-PATTERNS

- ❌ `localStorage` / `sessionStorage` - 用 `useCookie`
- ❌ `window` / `document` in setup - 用 `if (import.meta.client)`
- ❌ `ElMessage` in composables - 抛出错误
- ❌ 直接 `$fetch` 认证请求 - 用 `useApi()`
- ❌ setup 中访问浏览器 API - 用 `onMounted`

---

## CONFIG (nuxt.config.ts)

```typescript
{
  modules: ['@element-plus/nuxt', '@pinia/nuxt', '@nuxt/content'],
  ssr: true,
  runtimeConfig: {
    public: { apiBase: 'http://localhost:3000/api' }
  }
}
```

---

## COMMANDS

```bash
pnpm --filter @app/portal dev    # 开发服务器 (port 3001)
pnpm --filter @app/portal build  # 构建
```
