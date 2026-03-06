# AGENTS.md - Auth Module

**Generated:** 2026-03-06

---

## OVERVIEW

JWT authentication with refresh tokens, TOTP-based 2FA, OAuth providers (WeChat/DingTalk), and anomaly detection.

---

## STRUCTURE

```
auth/
├── decorators/          # @Public(), @CurrentUser() - route metadata
├── dto/                 # Input validation (login, register, 2FA, OAuth)
├── guards/              # JwtAuthGuard, RefreshTokenGuard
├── oauth/               # WeChat, DingTalk providers
├── services/            # 2FA, TOTP, anomaly-detection, breach-password
└── strategies/          # Passport JWT strategy
```

---

## WHERE TO LOOK

| Task                     | File                                          |
| ------------------------ | --------------------------------------------- |
| Token generation/refresh | `auth.service.ts:101-150`                     |
| 2FA setup & verification | `services/two-factor.service.ts`              |
| OAuth flow (WeChat)      | `oauth/wechat.service.ts:60-114`              |
| Anomaly detection logic  | `services/anomaly-detection.service.ts:40-86` |
| JWT validation           | `strategies/jwt.strategy.ts:40-52`            |
| Public route bypass      | `guards/jwt-auth.guard.ts:23-35`              |
| Custom user injection    | `decorators/current-user.decorator.ts:17-29`  |

---

## CONVENTIONS

### Token Types

JWT payload includes `type: 'access' | 'refresh'`. Access tokens expire in 15 minutes, refresh tokens in 7 days. Only access tokens pass `JwtStrategy.validate()`.

### 2FA Flow

1. Login returns `{ require2FA: true, tempToken: string }` if user has MFA enabled
2. Frontend calls `/auth/2fa/verify` with `tempToken` and TOTP code
3. On success, returns full `TokenResponse`

### OAuth Pattern

All OAuth services follow: `getAuthorizationUrl()` -> `handleCallback(code)` -> returns `TokenResponse`. They use `UsersService.findSocialAccount()` and `createOAuthUser()`.

### Pending Logins (2FA)

`TwoFactorService` uses in-memory `Map<string, PendingTwoFactorLogin>` with 5-minute TTL. Production should use Redis.

---

## ANTI-PATTERNS

- **NO** direct `userRepository` access in auth services - use `UsersService` or `DataSource` for transactions
- **NO** storing raw TOTP secrets - always base64 encode (use proper encryption in production)
- **NO** skipping anomaly checks for OAuth logins - still call `checkLogin()`
- **NO** reusing refresh tokens after rotation - blacklist old token immediately
- **NO** trusting OAuth user info without validation - verify `openid` matches social account
- **NO** using `@Public()` on endpoints that need audit logging
