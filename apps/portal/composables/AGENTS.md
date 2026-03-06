# Portal Composables

SSR-safe authentication and API wrapper composables for Nuxt 3.

## WHERE TO LOOK

| File         | Purpose               | Key Features                                                                        |
| ------------ | --------------------- | ----------------------------------------------------------------------------------- |
| `useApi.ts`  | HTTP client wrapper   | Auto token refresh on 401, request queue during refresh, `$fetch` with auth headers |
| `useAuth.ts` | Auth state management | Login/register/logout, OAuth integration, user fetching, auth guards                |

## CONVENTIONS

### SSR Safety (Critical)

Never use browser APIs in composable setup. All browser-specific code must check `import.meta.client`:

```typescript
// ✓ Correct - SSR-safe redirect
if (import.meta.client) {
  navigateTo('/login');
}

// ✗ Wrong - crashes on server
window.location.href = '/login';
```

Token storage uses `useCookie` from `auth.ts` store. Don't access `localStorage` or `sessionStorage` directly in composables.

### Token Refresh Strategy

`useApi` handles 401 errors automatically:

1. First 401 triggers refresh via `/auth/refresh`
2. Subsequent requests queue up in `failedQueue` array
3. After refresh succeeds, queued requests retry with new token
4. If refresh fails, redirect to login and clear auth state

The refresh logic lives in `useApi.ts` (lines 51-71), not `useAuth.ts`. This prevents circular dependencies since `useAuth` calls `useApi` for normal requests.

### Error Handling

Composables throw errors to callers. Don't catch and display UI messages inside composables:

```typescript
// ✓ Correct - let component handle UI
const handleLogin = async () => {
  try {
    await login(credentials);
  } catch (error) {
    ElMessage.error(error.message);
  }
};

// ✗ Wrong - composable shouldn't know about UI
const login = async (credentials) => {
  try {
    await api.post('/auth/login', credentials);
  } catch (error) {
    ElMessage.error(error.message); // No ElMessage in composables
  }
};
```

`useAuth` wraps errors in `Error` objects with message from `error.data?.message`. `useApi` leaves errors raw for callers.

### Initialization Pattern

`useAuth` initializes store state on first call (line 40-45). This runs only on client-side (line 169-171). Don't call store methods that access cookies during SSR.

## ANTI-PATTERNS

- **NO** `localStorage` or `sessionStorage` - use `useCookie` via auth store
- **NO** `window` or `document` in setup - wrap in `if (import.meta.client)`
- **NO** `ElMessage` or UI components in composables - throw errors instead
- **NO** direct `$fetch` for authenticated requests - use `useApi()` wrapper
- **NO** token refresh in `useAuth` - handled by `useApi` to avoid circular calls
- **NO** state outside composables - module-level `isRefreshing` and `failedQueue` in `useApi.ts` are necessary for cross-request coordination
