使用中文
# AGENTS.md - AI Agent Code Generation Guide

This document provides comprehensive guidelines for AI agents to generate code that matches this project's conventions.

---

## 1. 项目概述

This is a **monorepo** project using pnpm workspaces, containing:

| App            | Description            | Framework      | Port |
| -------------- | ---------------------- | -------------- | ---- |
| `apps/backend` | NestJS API server      | NestJS 11      | 3000 |
| `apps/portal`  | User-facing web app    | Nuxt 3 / Vue 3 | 3001 |
| `apps/admin`   | Admin management panel | Vue 3 SPA      | 3002 |

The project implements a full-stack authentication and RBAC (Role-Based Access Control) system with OAuth support (WeChat, DingTalk).

---

## 2. 技术栈

### Backend (NestJS)

- **Framework**: NestJS 11 with TypeScript 5.7
- **Database**: PostgreSQL with TypeORM 0.3
- **Cache**: Redis via custom cache service
- **Auth**: JWT with Passport, 2FA support
- **API Docs**: Swagger/OpenAPI

### Frontend

- **Portal**: Nuxt 3, Vue 3, Pinia, Element Plus
- **Admin**: Vue 3 SPA, Vue Router, Pinia, Element Plus

### Tooling

- **Package Manager**: pnpm 9.15+
- **Node**: >= 20.0.0
- **Linting**: ESLint 9
- **Formatting**: Prettier 3
- **Testing**: Bun test (backend), Vitest (frontend)

---

## 3. 项目结构

```
web-project/
├── apps/
│   ├── backend/                # NestJS API
│   │   ├── src/
│   │   │   ├── auth/           # Authentication module
│   │   │   │   ├── dto/        # Data Transfer Objects
│   │   │   │   ├── guards/     # Auth guards
│   │   │   │   ├── decorators/ # Custom decorators
│   │   │   │   ├── services/   # Auth-related services
│   │   │   │   └── oauth/      # OAuth providers
│   │   │   ├── users/          # User management
│   │   │   ├── policy/         # RBAC policies
│   │   │   ├── entities/       # TypeORM entities
│   │   │   ├── common/         # Shared utilities
│   │   │   │   ├── filters/    # Exception filters
│   │   │   │   └── interfaces/ # Shared interfaces
│   │   │   └── config/         # Configuration
│   │   └── test/               # E2E tests
│   │
│   ├── portal/                 # Nuxt 3 user portal
│   │   ├── composables/        # Vue composables
│   │   ├── stores/             # Pinia stores
│   │   ├── components/         # Vue components
│   │   ├── pages/              # File-based routes
│   │   └── locales/            # i18n files
│   │
│   └── admin/                  # Vue 3 admin panel
│       ├── src/
│       │   ├── api/            # API client
│       │   ├── stores/         # Pinia stores
│       │   ├── components/     # Vue components
│       │   ├── views/          # Page views
│       │   └── router/         # Vue Router config
│       └── public/
│
└── packages/                   # Shared packages (if any)
```

---

## 4. 代码风格规范

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### Naming Conventions

| Type                | Convention                | Example               |
| ------------------- | ------------------------- | --------------------- |
| Files (components)  | PascalCase                | `UserAvatar.vue`      |
| Files (composables) | camelCase with use prefix | `useAuth.ts`          |
| Files (stores)      | camelCase                 | `auth.ts`             |
| Files (DTOs)        | kebab-case                | `register.dto.ts`     |
| Classes             | PascalCase                | `UsersService`        |
| Interfaces          | PascalCase                | `UserProfileResponse` |
| Variables           | camelCase                 | `currentUser`         |
| Constants           | UPPER_SNAKE_CASE          | `IS_PUBLIC_KEY`       |
| Database columns    | snake_case                | `password_hash`       |
| CSS classes         | kebab-case                | `avatar-wrapper`      |

---

## 5. 后端约定 (NestJS)

### Module Organization

Each feature module follows this structure:

```
feature/
├── dto/
│   ├── create-feature.dto.ts
│   ├── update-feature.dto.ts
│   └── index.ts              # Barrel export
├── feature.module.ts
├── feature.service.ts
├── feature.service.spec.ts
├── feature.controller.ts
└── entities/                 # If module-specific
```

### DTO Patterns with class-validator

```typescript
// dto/register.dto.ts
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsEmail,
  IsOptional,
  Matches,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'Username is required' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(50, { message: 'Username must not exceed 50 characters' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  email?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Invalid phone number format' })
  phone?: string;

  // Conditional validation
  @ValidateIf((o: RegisterDto) => !o.email && !o.phone)
  @IsNotEmpty({ message: 'Either email or phone is required' })
  emailOrPhone?: string;
}
```

### Service Patterns with @InjectRepository

```typescript
// users.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async create(data: CreateUserData): Promise<User> {
    const existingUser = await this.findByUsername(data.username);
    if (existingUser) {
      throw new ConflictException('Username already exists');
    }

    const user = this.usersRepository.create({
      username: data.username,
      passwordHash: data.passwordHash,
      email: data.email || null,
    });

    return this.usersRepository.save(user);
  }
}
```

### Controller Patterns

```typescript
// users.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Version,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../policy/guards/permission.guard';
import { RequirePermission } from '../policy/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../entities/user.entity';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @Version('1')
  async getCurrentUser(@CurrentUser() user: User): Promise<UserProfileResponse> {
    return this.toUserProfileResponse(user);
  }

  @Get()
  @Version('1')
  @RequirePermission('user', 'read')
  @ApiOperation({ summary: 'Admin: Get list of users with pagination' })
  @ApiQuery({ name: 'keyword', required: false })
  async adminListUsers(@Query() query: AdminUserQueryDto): Promise<AdminUserListResponse> {
    const { data, total } = await this.usersService.findAll(query);
    return {
      data: data.map((user) => this.toAdminUserResponse(user)),
      pagination: { total, limit: query.limit ?? 20, offset: query.offset ?? 0 },
    };
  }

  @Post()
  @Version('1')
  @RequirePermission('user', 'create')
  @ApiOperation({ summary: 'Admin: Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  async adminCreateUser(@Body() dto: AdminCreateUserDto): Promise<AdminUserResponse> {
    const user = await this.usersService.adminCreate(dto);
    return this.toAdminUserResponse(user);
  }
}
```

### Entity Patterns with TypeORM

```typescript
// entities/user.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';

export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
  PENDING = 'pending',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50 })
  username: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  // snake_case for database columns
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  // Relations
  @ManyToMany(() => require('./role.entity').Role, { cascade: true })
  @JoinTable({
    name: 'user_roles',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'role_id', referencedColumnName: 'id' },
  })
  roles: Role[];
}
```

### Error Handling

Use NestJS built-in exceptions:

```typescript
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';

// Common patterns:
throw new ConflictException('Username already exists');
throw new NotFoundException('User not found');
throw new BadRequestException('Invalid input data');
throw new UnauthorizedException('Invalid credentials');
throw new ForbiddenException('Insufficient permissions');
```

**Standardized Error Response** (from global exception filter):

```typescript
interface ErrorResponse {
  statusCode: number; // HTTP status code
  message: string; // Human-readable message
  error: string; // Error type/name
  timestamp: string; // ISO 8601 timestamp
  path: string; // Request path
}
```

### Guards and Decorators Reference

| Decorator                            | Purpose                   | Usage                     |
| ------------------------------------ | ------------------------- | ------------------------- |
| `@Public()`                          | Bypass JWT auth           | Login, register endpoints |
| `@CurrentUser()`                     | Inject authenticated user | Get current user info     |
| `@RequireRole('admin')`              | Role-based access         | Admin-only endpoints      |
| `@RequirePermission('user', 'read')` | Permission-based access   | Fine-grained control      |
| `@AuditLog('create', 'user')`        | Enable audit logging      | Mutating operations       |

```typescript
// Example: Public endpoint (no auth required)
@Public()
@Post('login')
login(@Body() loginDto: LoginDto) { ... }

// Example: Get current user
@Get('me')
@Version('1')
async getCurrentUser(@CurrentUser() user: User) { ... }

// Example: Role-based access
@RequireRole('admin')
@Get('admin/users')
getAllUsers() { ... }

// Example: Permission-based access
@RequirePermission('user', 'delete')
@Delete(':id')
deleteUser(@Param('id') id: string) { ... }

// Example: Audit logging
@Post()
@AuditLog('create', 'user')
createUser(@Body() dto: CreateUserDto) { ... }
```

---

## 6. 前端约定 (Vue 3)

### Composition API + Script Setup

All Vue components use `<script setup lang="ts">`:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

interface Props {
  avatar?: string;
  username?: string;
  size?: number;
}

const props = withDefaults(defineProps<Props>(), {
  avatar: '',
  username: '',
  size: 100,
});

const emit = defineEmits<{
  (e: 'upload', file: File): void;
  (e: 'success', url: string): void;
  (e: 'error', error: Error): void;
}>();

const { t } = useI18n();
const uploading = ref(false);

const placeholderText = computed(() => {
  return props.username?.charAt(0)?.toUpperCase() || '?';
});

const handleUpload = async (file: File) => {
  uploading.value = true;
  emit('upload', file);
  // ...
};
</script>
```

### Portal vs Admin - CRITICAL DIFFERENCES

| Feature            | Portal (Nuxt 3)           | Admin (Vue 3 SPA)                         |
| ------------------ | ------------------------- | ----------------------------------------- |
| **HTTP Client**    | `$fetch` (Nuxt native)    | `axios`                                   |
| **Token Storage**  | `useCookie` (SSR-safe)    | `localStorage`                            |
| **Auto-imports**   | Yes (Nuxt/Vue APIs)       | No (explicit imports)                     |
| **Routing**        | File-based (`pages/`)     | Explicit (`router/`)                      |
| **Token Refresh**  | Auto (with request queue) | No (logout on 401)                        |
| **Error Handling** | Throws to caller          | `extractApiError()` + `ElMessage.error()` |

### Portal (Nuxt 3) Specific Patterns

**API Wrapper with $fetch:**

```typescript
// composables/useApi.ts
import { useAuthStore } from '~/stores/auth';

export const useApi = () => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();
  const apiBase = config.public.apiBase;

  const request = async <T>(url: string, options: RequestOptions = {}): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }

    const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`;

    // Auto token refresh on 401
    try {
      return await $fetch<T>(fullUrl, {
        method: options.method || 'GET',
        body: options.body,
        query: options.query,
        headers,
      });
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Handle token refresh...
      }
      throw error;
    }
  };

  return { get, post, put, del, patch };
};
```

**Pinia Store with useCookie:**

```typescript
// stores/auth.ts
import { defineStore } from 'pinia';

export const useAuthStore = defineStore('auth', () => {
  // Use cookies for SSR-friendly persistence
  const tokenCookie = useCookie('access_token', {
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
  });

  const refreshTokenCookie = useCookie('refresh_token', {
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    sameSite: 'lax',
  });

  const user = ref<User | null>(null);
  const token = ref<string | null>(tokenCookie.value || null);
  const refreshToken = ref<string | null>(refreshTokenCookie.value || null);

  const isLoggedIn = computed(() => !!token.value);

  const setAuth = (data: { user: User; token: string; refreshToken: string }) => {
    user.value = data.user;
    token.value = data.token;
    refreshToken.value = data.refreshToken;

    tokenCookie.value = data.token;
    refreshTokenCookie.value = data.refreshToken;
  };

  const clearAuth = () => {
    user.value = null;
    token.value = null;
    refreshToken.value = null;
    tokenCookie.value = null;
    refreshTokenCookie.value = null;
  };

  return { user, token, refreshToken, isLoggedIn, setAuth, clearAuth };
});
```

### Admin (Vue 3 SPA) Specific Patterns

**API Client with axios:**

```typescript
// admin/src/api/index.ts
import axios, { type AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  displayMessage: string; // "[statusCode] message"
}

export function extractApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<{
    statusCode?: number;
    message?: string;
    error?: string;
  }>;

  const response = axiosError.response;

  if (response?.data) {
    return {
      statusCode: response.data.statusCode || response.status || 500,
      message: response.data.message || 'An error occurred',
      error: response.data.error || 'Error',
      displayMessage: `[${response.data.statusCode}] ${response.data.message}`,
    };
  }

  if (!axiosError.response) {
    return {
      statusCode: 0,
      message: 'Network error',
      error: 'NetworkError',
      displayMessage: '[0] Network error, please check connection',
    };
  }

  return {
    statusCode: axiosError.response.status || 500,
    message: axiosError.message,
    error: 'UnknownError',
    displayMessage: `[${axiosError.response.status}] ${axiosError.message}`,
  };
}

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

// Auto logout on 401 (no auto refresh)
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      authStore.logout();
      router.push({ name: 'Login' });
    }
    return Promise.reject(error);
  }
);

export default api;
```

**Error Handling in Admin:**

```typescript
// Admin components use extractApiError + ElMessage
import { extractApiError } from '@/api';
import { ElMessage } from 'element-plus';

const handleSubmit = async () => {
  try {
    await api.post('/users', formData);
    ElMessage.success('User created successfully');
  } catch (error) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
};
```

### i18n Usage

Both Portal and Admin use `vue-i18n`:

```typescript
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// In template:
// {{ t('profile.changeAvatar') }}
// {{ t('common.save') }}
```

---

## 7. TypeScript 类型约定

### Type vs Interface

- Use **interface** for object shapes that may be extended
- Use **type** for unions, intersections, or when immutability is preferred

```typescript
// Interface for DTOs and responses (can be extended)
export interface UserProfileResponse {
  id: string;
  username: string;
  email: string | null;
  status: UserStatus;
}

// Type for unions and complex types
export type UserStatus = 'active' | 'disabled' | 'pending';

// Type for function signatures
export type ApiClient = {
  get<T>(url: string): Promise<T>;
  post<T>(url: string, body?: unknown): Promise<T>;
};
```

### Naming Conventions for Types

| Suffix     | Usage                        | Example                                 |
| ---------- | ---------------------------- | --------------------------------------- |
| `Dto`      | Data Transfer Object (input) | `RegisterDto`, `UpdateProfileDto`       |
| `Response` | API response type            | `UserProfileResponse`, `AuthResponse`   |
| `Data`     | Internal data structure      | `CreateUserData`, `AdminUpdateUserData` |
| `Query`    | Query parameters             | `AdminUserQueryDto`                     |
| `Payload`  | JWT or token payload         | `CustomJwtPayload`                      |

### Nullability

- Use `| null` for nullable database fields
- Use `?:` for optional input parameters

```typescript
// Entity fields (nullable in DB)
email: string | null;
phone: string | null;

// DTO fields (optional input)
@IsOptional()
email?: string;

// Response interfaces
interface UserProfileResponse {
  email: string | null;  // Can be null from DB
  nickname: string | null;
}
```

---

## 8. 测试模式

### Backend Testing with Bun

```typescript
// auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { mock, describe, it, expect, beforeEach, afterEach } from 'bun:test';

// Mock external modules
mock.module('bcrypt', () => ({
  hash: mock(async () => 'hashed_password'),
  compare: mock(async () => true),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    create: mock(),
    findByUsername: mock(),
    findById: mock(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        // ... other providers
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    mockUsersService.create.mockClear();
    mockUsersService.findByUsername.mockClear();
  });

  it('should hash password with bcrypt', async () => {
    const result = await service.hashPassword('Password123');
    expect(result).toBe('hashed_password');
  });

  it('should throw if username exists', async () => {
    mockUsersService.findByUsername.mockResolvedValue({ id: '1' });
    await expect(service.register(dto)).rejects.toThrow(ConflictException);
  });
});
```

### Frontend Testing with Vitest

```typescript
// Component testing
import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import UserAvatar from '@/components/UserAvatar.vue';

describe('UserAvatar', () => {
  it('renders with default props', () => {
    const wrapper = mount(UserAvatar);
    expect(wrapper.find('.user-avatar').exists()).toBe(true);
  });

  it('displays first letter of username', () => {
    const wrapper = mount(UserAvatar, {
      props: { username: 'John' },
    });
    expect(wrapper.text()).toContain('J');
  });
});
```

---

## 9. 数据库迁移

### Commands

```bash
# Generate migration from entity changes
pnpm migration:generate -- -n <MigrationName>

# Run pending migrations
pnpm migration:run

# Revert last migration
pnpm migration:revert

# Show migration status
pnpm migration:show
```

### Migration File Pattern

```typescript
// migrations/1234567890-AddUserTable.ts
import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddUserTable1234567890 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'username',
            type: 'varchar',
            length: '50',
            isUnique: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
```

---

## 10. 禁止事项

### General

- **NO** `var` - use `const` or `let`
- **NO** `any` without a comment explaining why
- **NO** `console.log` in production code - use proper logging
- **NO** circular dependencies between modules

### Backend Specific

- **NO** direct database access outside services
- **NO** business logic in controllers
- **NO** hardcoded configuration values - use ConfigService

### Frontend Specific

- **NO** `localStorage` in Portal (Nuxt) - use `useCookie` for SSR
- **NO** raw `fetch` or `axios` calls in components - use composables
- **NO** direct DOM manipulation - use Vue refs
- **NO** synchronous blocking operations

### Portal (Nuxt) Specific

- **NO** `localStorage` or `sessionStorage` - not SSR-safe
- **NO** `window` or `document` in setup - use `onMounted` or `import.meta.client`

### Admin (Vue 3 SPA) Specific

- **NO** auto token refresh - logout on 401

---

## 11. 常见任务

### Create New Backend Module

```bash
# 1. Create directory structure
mkdir -p apps/backend/src/feature/{dto,services,guards,decorators}

# 2. Create files
touch apps/backend/src/feature/feature.module.ts
touch apps/backend/src/feature/feature.service.ts
touch apps/backend/src/feature/feature.controller.ts
touch apps/backend/src/feature/dto/create-feature.dto.ts

# 3. Register module in app.module.ts
```

### Create New Vue Component

```vue
<!-- components/FeatureCard.vue -->
<template>
  <div class="feature-card">
    <h3>{{ title }}</h3>
    <slot />
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
}

defineProps<Props>();
</script>

<style scoped>
.feature-card {
  padding: 16px;
  border-radius: 8px;
}
</style>
```

### Create New Composable (Portal)

```typescript
// composables/useFeature.ts
export const useFeature = () => {
  const api = useApi();
  const loading = ref(false);
  const data = ref<FeatureData | null>(null);

  const fetchData = async (id: string) => {
    loading.value = true;
    try {
      data.value = await api.get<FeatureData>(`/features/${id}`);
    } finally {
      loading.value = false;
    }
  };

  return { data, loading, fetchData };
};
```

### Create New API Endpoint

1. Create DTO in `dto/`
2. Add method to service
3. Add controller route with proper decorators
4. Add Swagger documentation
5. Write tests

---

## 12. 参考文件

### Backend Reference Files

| File                                                       | Purpose                            |
| ---------------------------------------------------------- | ---------------------------------- |
| `apps/backend/src/auth/dto/register.dto.ts`                | Complex DTO with class-validator   |
| `apps/backend/src/users/users.service.ts`                  | Service with `@InjectRepository`   |
| `apps/backend/src/users/users.controller.ts`               | Controller with guards and Swagger |
| `apps/backend/src/entities/user.entity.ts`                 | Entity with TypeORM decorators     |
| `apps/backend/src/common/filters/all-exceptions.filter.ts` | Global error handling              |
| `apps/backend/src/audit/decorators/audit-log.decorator.ts` | Custom decorator pattern           |
| `apps/backend/src/auth/auth.module.ts`                     | Module with async configuration    |
| `apps/backend/src/auth/auth.service.spec.ts`               | Bun test patterns                  |

### Frontend Reference Files

| File                                    | Purpose                                    |
| --------------------------------------- | ------------------------------------------ |
| `apps/portal/composables/useApi.ts`     | Portal API with `$fetch` and token refresh |
| `apps/portal/composables/useAuth.ts`    | Composable pattern                         |
| `apps/portal/stores/auth.ts`            | Pinia Setup syntax with `useCookie`        |
| `apps/portal/components/UserAvatar.vue` | Vue component with script setup            |
| `apps/admin/src/api/index.ts`           | Admin API with axios and `extractApiError` |

### Configuration Files

| File                         | Purpose                  |
| ---------------------------- | ------------------------ |
| `.prettierrc`                | Code formatting rules    |
| `package.json`               | Dependencies and scripts |
| `apps/backend/tsconfig.json` | TypeScript configuration |

---

## Quick Reference

### Response Format

```typescript
// Success
{ success: true, data: {...}, message: "Operation successful" }

// Error (from global filter)
{ statusCode: 400, message: "Validation failed", error: "BadRequest", timestamp: "...", path: "/api/v1/users" }
```

### Common Imports

```typescript
// Backend
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

// Frontend (Portal)
import { ref, computed } from 'vue';
import { useApi } from '~/composables/useApi';
import { useAuthStore } from '~/stores/auth';

// Frontend (Admin)
import { ref, computed } from 'vue';
import api, { extractApiError } from '@/api';
import { useAuthStore } from '@/stores/auth';
import { ElMessage } from 'element-plus';
```
