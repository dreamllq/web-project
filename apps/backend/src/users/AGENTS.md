# users Module - AGENTS.md

## OVERVIEW

非标准多控制器模块,处理用户核心 CRUD、设备管理、登录历史和头像上传。

## STRUCTURE

```
users/
├── users.controller.ts          # 主控制器 - 用户 CRUD、管理员操作
├── users.service.ts             # 主服务 (491 lines)
├── controllers/                 # 子控制器 (非标准位置)
│   ├── device.controller.ts     # 设备管理
│   ├── login-history.controller.ts  # 登录历史
│   └── avatar.controller.ts     # 头像上传
├── services/
│   ├── user-device.service.ts   # 设备逻辑 (196 lines)
│   └── login-history.service.ts # 登录逻辑 (170 lines)
└── dto/
    ├── admin-*.dto.ts           # 管理员 DTO
    └── update-profile.dto.ts    # 用户 DTO
```

## WHERE TO LOOK

| 需求                  | 位置                                       |
| --------------------- | ------------------------------------------ |
| 用户 CRUD、管理员操作 | `users.controller.ts` + `users.service.ts` |
| 设备信任/移除         | `controllers/device.controller.ts`         |
| 登录历史              | `controllers/login-history.controller.ts`  |
| 头像上传              | `controllers/avatar.controller.ts`         |

## CONVENTIONS

### 为什么多个控制器?

按领域职责拆分,避免单一文件过大:

1. **users.controller.ts** - 核心用户管理 (`/users/me`, `/users/:id`)
2. **device.controller.ts** - 设备生命周期 (`/users/me/devices`)
3. **login-history.controller.ts** - 审计日志 (`/users/me/login-history`)
4. **avatar.controller.ts** - 文件上传 (图片处理在控制器内)

### 服务分离

- **users.service.ts** - 用户实体操作、密码验证
- **user-device.service.ts** - 设备注册、指纹生成
- **login-history.service.ts** - 登录记录

### 非标准模式

- Response 接口定义在控制器内
- 用户操作: `/users/me/*`
- 管理员操作: `/users/*` (需 `@RequirePermission`)

## ANTI-PATTERNS

❌ 子控制器不要添加管理员路由
❌ 不要跳过服务层直接操作数据库
❌ 不要混用用户和管理员 DTO
❌ 不要忘记 `@RegisterSubjectType` (ABAC 主题注册)
