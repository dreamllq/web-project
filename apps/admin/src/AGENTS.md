# AGENTS.md - Admin Panel (Vue 3 SPA)

**Generated:** 2026-03-06

使用中文

---

## 1. OVERVIEW

Vue 3 SPA管理面板，使用Vue Router显式路由和axios HTTP客户端。

---

## 2. STRUCTURE

```
src/
├── api/              # axios + extractApiError() + API模块 (user, role, permission, policy等)
├── views/            # 页面: Users, Roles, Permissions, Policies, AuditLogs, Profile, Login
├── stores/           # Pinia: auth.ts (localStorage)
├── router/           # Vue Router显式路由
├── locales/          # i18n: zh-CN, en-US
├── types/            # TypeScript: auth, user, permission, audit-log
├── utils/, layouts/, components/
```

**查找位置:** 添加页面→`views/`+`router/`, API→`api/`, 错误处理→`extractApiError()`, 类型→`types/`

---

## 4. CONVENTIONS (Admin特有)

### API错误处理 (必须遵循)

```typescript
try {
  await api.post('/users', data);
  ElMessage.success('创建成功');
} catch (error: unknown) {
  const apiError = extractApiError(error);
  ElMessage.error(apiError.displayMessage); // "[400] 用户名已存在"
}
```

### 关键差异

- **Token存储:** `localStorage` (非useCookie)
- **401处理:** 自动刷新token，失败则跳转登录
- **API模块:** 每个功能域一个文件 (`api/user.ts`, `api/role.ts`等)
- **错误显示:** 必须使用 `extractApiError()` + `ElMessage.error()`

---

## 5. ANTI-PATTERNS

| 禁止                 | 正确做法                                  |
| -------------------- | ----------------------------------------- |
| 直接 `axios`/`fetch` | 使用 `@/api` 模块                         |
| `catch` 不显示错误   | `extractApiError()` + `ElMessage.error()` |
| 使用 `useCookie`     | 使用 `localStorage`                       |

## 6. 与Portal差异

| 特性  | Admin           | Portal    |
| ----- | --------------- | --------- |
| HTTP  | axios           | $fetch    |
| Token | localStorage    | useCookie |
| 路由  | 显式            | 文件路由  |
| 错误  | extractApiError | 抛出      |
| SSR   | ❌              | ✅        |
