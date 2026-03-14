# 聊天功能服务端设计文档

**版本:** 1.0.0 | **生成日期:** 2026-03-14 | **状态:** 完成

---

## TL;DR

本文档描述了聊天模块的完整服务端架构设计，包括：

- **系统架构**: 基于 NestJS 的 WebSocket + REST API 双协议设计
- **数据模型**: 4 个核心实体 (Room, RoomMember, Message, MessageRead)
- **实时通信**: Socket.IO + Redis Adapter 支持多实例部署
- **消息队列**: Bull + Redis 处理离线通知和异步任务
- **部署方案**: Docker + Nginx 负载均衡配置

**技术栈:** NestJS 11 / TypeORM / Socket.IO / Bull / Redis / PostgreSQL

---

## 目录

- [1. 系统架构](#1-系统架构)
  - [1.1 架构概述](#11-架构概述)
  - [1.2 模块设计](#12-模块设计)
  - [1.3 WebSocket 连接流程](#13-websocket-连接流程)
  - [1.4 认证机制](#14-认证机制)
  - [1.5 多实例同步](#15-多实例同步)
  - [1.6 消息队列架构](#16-消息队列架构)
  - [1.7 在线状态管理](#17-在线状态管理)
  - [1.8 扩展性设计](#18-扩展性设计)
- [2. 数据模型](#2-数据模型)
  - [2.1 实体关系图](#21-实体关系图)
  - [2.2 Room 实体](#22-room-实体)
  - [2.3 RoomMember 实体](#23-roommember-实体)
  - [2.4 Message 实体](#24-message-实体)
  - [2.5 MessageRead 实体](#25-messageread-实体)
  - [2.6 索引设计说明](#26-索引设计说明)
  - [2.7 数据完整性约束](#27-数据完整性约束)
- [3. API 参考](#3-api-参考)
  - [3.1 概述](#31-概述)
  - [3.2 REST API](#32-rest-api)
  - [3.3 WebSocket 事件](#33-websocket-事件)
  - [3.4 数据类型](#34-数据类型)
  - [3.5 API 端点汇总](#35-api-端点汇总)
  - [3.6 常见使用场景](#36-常见使用场景)
- [4. 消息队列与部署](#4-消息队列与部署)
  - [4.1 消息队列架构](#41-消息队列架构)
  - [4.2 任务处理流程](#42-任务处理流程)
  - [4.3 离线用户通知](#43-离线用户通知)
  - [4.4 队列事件监听](#44-队列事件监听)
  - [4.5 部署指南](#45-部署指南)
  - [4.6 多实例部署](#46-多实例部署)
  - [4.7 运维指南](#47-运维指南)
  - [4.8 配置速查表](#48-配置速查表)
  - [4.9 部署检查清单](#49-部署检查清单)

---

# 1. 系统架构

## 1.1 架构概述

聊天模块采用 NestJS 框架构建，实现了基于 WebSocket 的实时通信功能。整体架构采用分层设计，包含网关层、服务层、数据层和消息队列层。

### 系统组件关系图

```mermaid
flowchart TB
    subgraph Client["客户端"]
        Portal["Portal (Nuxt 3)"]
        Admin["Admin (Vue 3)"]
    end

    subgraph Backend["后端服务"]
        subgraph Gateway["网关层"]
            ChatGateway["ChatGateway\nWebSocket /chat"]
            ChatController["ChatController\nREST /api/v1/chat"]
        end

        subgraph Service["服务层"]
            ChatService["ChatService\n聚合服务"]
            RoomService["RoomService"]
            MessageService["MessageService"]
            PresenceService["PresenceService"]
        end

        subgraph Queue["消息队列"]
            MessageProcessor["MessageProcessor"]
            MessageEvents["MessageEvents"]
        end
    end

    subgraph Storage["存储层"]
        PostgreSQL[(PostgreSQL)]
        Redis[(Redis)]
    end

    subgraph External["外部服务"]
        AuthService["AuthService\nJWT 认证"]
        NotificationService["NotificationService"]
    end

    Portal -->|"WebSocket + JWT"| ChatGateway
    Admin -->|"REST + JWT"| ChatController

    ChatGateway --> AuthService
    ChatGateway --> ChatService
    ChatGateway --> PresenceService

    ChatController --> ChatService
    ChatController --> RoomService

    ChatService --> RoomService
    ChatService --> MessageService
    ChatService --> Queue

    RoomService --> PostgreSQL
    MessageService --> PostgreSQL
    PresenceService --> Redis

    MessageProcessor --> NotificationService
    MessageProcessor --> PresenceService
    MessageProcessor --> RoomService

    Queue --> PostgreSQL
```

### 核心组件说明

| 组件             | 职责                         | 文件位置                                             |
| ---------------- | ---------------------------- | ---------------------------------------------------- |
| ChatGateway      | WebSocket 连接管理、事件处理 | `apps/backend/src/chat/chat.gateway.ts`              |
| ChatController   | REST API 端点                | `apps/backend/src/chat/chat.controller.ts`           |
| ChatService      | 聚合服务，协调各子服务       | `apps/backend/src/chat/chat.service.ts`              |
| RoomService      | 房间 CRUD、成员管理          | `apps/backend/src/chat/services/room.service.ts`     |
| MessageService   | 消息 CRUD、已读状态          | `apps/backend/src/chat/services/message.service.ts`  |
| PresenceService  | 在线状态管理 (Redis)         | `apps/backend/src/chat/services/presence.service.ts` |
| MessageProcessor | 队列任务处理                 | `apps/backend/src/chat/queue/message.processor.ts`   |

---

## 1.2 模块设计

### ChatModule 结构

```
apps/backend/src/chat/
├── chat.module.ts          # 模块定义
├── chat.controller.ts      # REST API 控制器 (296 行)
├── chat.gateway.ts         # WebSocket 网关 (386 行)
├── chat.service.ts         # 聚合服务 (377 行)
├── dto/
│   ├── index.ts            # DTO 导出
│   ├── create-room.dto.ts  # 创建房间 DTO
│   ├── add-member.dto.ts   # 添加成员 DTO
│   ├── edit-message.dto.ts # 编辑消息 DTO
│   └── message-query.dto.ts # 消息查询 DTO
├── services/
│   ├── room.service.ts     # 房间服务 (582 行)
│   ├── message.service.ts  # 消息服务 (387 行)
│   └── presence.service.ts # 在线状态服务 (143 行)
└── queue/
    ├── index.ts            # 队列导出
    ├── message.processor.ts # 消息处理器 (181 行)
    └── message.events.ts   # 队列事件监听 (200 行)
```

### 模块依赖图

```mermaid
graph TB
    subgraph ChatModule["ChatModule"]
        ChatController["ChatController"]
        ChatGateway["ChatGateway"]
        ChatService["ChatService"]
        RoomService["RoomService"]
        MessageService["MessageService"]
        PresenceService["PresenceService"]
        MessageProcessor["MessageProcessor"]
        MessageEvents["MessageEvents"]
    end

    subgraph Entities["TypeORM Entities"]
        Room["Room"]
        RoomMember["RoomMember"]
        Message["Message"]
        MessageRead["MessageRead"]
    end

    subgraph Queue["Bull Queue"]
        MESSAGE_QUEUE["MESSAGE_QUEUE"]
    end

    subgraph External["外部模块"]
        AuthService["AuthService"]
        NotificationService["NotificationService"]
        CustomCacheService["CustomCacheService"]
    end

    ChatController --> ChatService
    ChatController --> RoomService

    ChatGateway --> AuthService
    ChatGateway --> ChatService
    ChatGateway --> PresenceService

    ChatService --> RoomService
    ChatService --> MessageService
    ChatService --> MESSAGE_QUEUE

    MessageProcessor --> NotificationService
    MessageProcessor --> PresenceService
    MessageProcessor --> RoomService

    RoomService --> Room
    RoomService --> RoomMember
    MessageService --> Message
    MessageService --> MessageRead

    PresenceService --> CustomCacheService
```

### 模块定义代码

**文件:** `apps/backend/src/chat/chat.module.ts`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Room, RoomMember, Message, MessageRead]),
    BullModule.registerQueue({
      name: MESSAGE_QUEUE,
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    RoomService,
    MessageService,
    PresenceService,
    ChatGateway,
    MessageProcessor,
    MessageEvents,
  ],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}
```

### 服务职责划分

| 服务            | 职责                     | 关键方法                                                         |
| --------------- | ------------------------ | ---------------------------------------------------------------- |
| ChatService     | 聚合层，协调业务流程     | `sendMessage()`, `editMessage()`, `markAsRead()`                 |
| RoomService     | 房间生命周期管理         | `create()`, `isMember()`, `addMember()`, `updateLastMessageAt()` |
| MessageService  | 消息持久化               | `create()`, `edit()`, `recall()`, `getMessages()`                |
| PresenceService | 在线状态 (Redis TTL 60s) | `setOnline()`, `setOffline()`, `getOnlineUsers()`                |

---

## 1.3 WebSocket 连接流程

### 命名空间配置

```typescript
// apps/backend/src/chat/chat.gateway.ts:84-88
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect
```

### 连接认证时序图

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant Gateway as ChatGateway
    participant Auth as AuthService
    participant Presence as PresenceService
    participant Redis as Redis

    Client->>Gateway: WebSocket 连接请求
    Note over Client,Gateway: token 在 query 或 Authorization header

    Gateway->>Gateway: extractTokenFromAuthHeader()

    alt 无 Token
        Gateway-->>Client: emit('error', {message: 'Authentication required'})
        Gateway->>Client: disconnect(true)
    else 有 Token
        Gateway->>Auth: validateAccessToken(token)

        alt Token 无效
            Auth-->>Gateway: 抛出异常
            Gateway-->>Client: emit('error', {message: 'Invalid or expired token'})
            Gateway->>Client: disconnect(true)
        else Token 有效
            Auth-->>Gateway: 返回用户信息
            Gateway->>Gateway: 附加用户到 socket.data.user
            Gateway->>Presence: setOnline(userId)
            Presence->>Redis: SET presence:{userId} TTL=60s
            Gateway-->>Client: emit('connection', {message, userId, timestamp})
            Note over Client,Gateway: 连接建立成功
        end
    end
```

### 连接处理代码

**文件:** `apps/backend/src/chat/chat.gateway.ts:104-147`

```typescript
async handleConnection(client: Socket): Promise<void> {
  try {
    // 1. 从 query 或 auth header 提取 token
    const token =
      (client.handshake.query.token as string) ||
      this.extractTokenFromAuthHeader(client.handshake.headers.authorization);

    if (!token) {
      client.emit('error', { message: 'Authentication required' });
      client.disconnect(true);
      return;
    }

    // 2. 验证 token 获取用户
    const user = await this.authService.validateAccessToken(token);

    // 3. 附加用户信息到 socket
    (client.data as { user: WsUser }).user = {
      id: user.id,
      username: user.username,
    };

    // 4. 设置用户在线状态
    await this.presenceService.setOnline(user.id);

    // 5. 发送连接成功事件
    client.emit('connection', {
      message: 'Connected to chat',
      userId: user.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    client.emit('error', { message: 'Invalid or expired token' });
    client.disconnect(true);
  }
}
```

### 断开连接处理

**文件:** `apps/backend/src/chat/chat.gateway.ts:152-163`

```typescript
async handleDisconnect(client: Socket): Promise<void> {
  const userData = client.data as { user?: WsUser };
  const user = userData.user;

  if (user) {
    // 设置用户离线状态 (删除 Redis 缓存)
    await this.presenceService.setOffline(user.id);
    this.logger.log(`Client disconnected: ${client.id}, User: ${user.username}`);
  }
}
```

### WebSocket 事件定义

| 方向          | 事件           | Payload                                           | 说明     |
| ------------- | -------------- | ------------------------------------------------- | -------- |
| Server→Client | `connection`   | `{message, userId, timestamp}`                    | 连接成功 |
| Server→Client | `error`        | `{message}`                                       | 错误通知 |
| Client→Server | `joinRoom`     | `{roomId}`                                        | 加入房间 |
| Client→Server | `leaveRoom`    | `{roomId}`                                        | 离开房间 |
| Client→Server | `sendMessage`  | `SendMessagePayload`                              | 发送消息 |
| Client→Server | `editMessage`  | `{messageId, content}`                            | 编辑消息 |
| Client→Server | `typing`       | `{roomId, isTyping}`                              | 输入状态 |
| Client→Server | `markRead`     | `{roomId}`                                        | 标记已读 |
| Server→Room   | `userJoined`   | `{userId, username, roomId, timestamp}`           | 用户加入 |
| Server→Room   | `userLeft`     | `{userId, username, roomId, timestamp}`           | 用户离开 |
| Server→Room   | `userTyping`   | `{userId, username, roomId, isTyping, timestamp}` | 输入中   |
| Server→Room   | `messagesRead` | `{userId, username, roomId, timestamp}`           | 已读回执 |

---

## 1.4 认证机制

### JWT Token 结构

聊天模块复用系统的 JWT 认证机制，使用 `AuthService` 进行 token 验证。

**Payload 结构:**

```typescript
interface CustomJwtPayload {
  sub: string; // 用户 ID
  username: string; // 用户名
  type: 'access' | 'refresh';
}
```

**Token 配置:**

| Token 类型    | 过期时间 | 用途               |
| ------------- | -------- | ------------------ |
| Access Token  | 15 分钟  | WebSocket 连接认证 |
| Refresh Token | 7 天     | 刷新 Access Token  |

### JWT 验证流程

```mermaid
flowchart LR
    subgraph Client["客户端"]
        A[携带 JWT Token]
    end

    subgraph Backend["后端"]
        B[ChatGateway.handleConnection]
        C[AuthService.validateAccessToken]
        D[JwtService.verify]
    end

    A -->|query.token 或 Authorization: Bearer| B
    B --> C
    C --> D
    D -->|验证通过| E[附加用户到 socket.data]
    D -->|验证失败| F[disconnect]
```

### Token 验证代码

**文件:** `apps/backend/src/auth/auth.service.ts` (validateAccessToken 方法)

```typescript
async validateAccessToken(token: string): Promise<User> {
  const jwtConfig = this.configService.get<JwtConfig>('jwt');

  const payload = this.jwtService.verify<CustomJwtPayload>(token, {
    secret: jwtConfig.secret,
  });

  // 验证是 access token
  if (payload.type !== 'access') {
    throw new UnauthorizedException('Invalid token type');
  }

  const user = await this.usersService.findById(payload.sub);
  if (!user) {
    throw new UnauthorizedException('User not found');
  }

  return user;
}
```

### Token 提取方式

**文件:** `apps/backend/src/chat/chat.gateway.ts:376-385`

```typescript
private extractTokenFromAuthHeader(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  return null;
}
```

### 客户端连接示例

**Portal (Nuxt 3) 使用 useCookie:**

```typescript
const token = useCookie('access_token');
const socket = io('/chat', {
  auth: { token: token.value },
  // 或使用 query
  query: { token: token.value },
});
```

**Admin (Vue 3) 使用 localStorage:**

```typescript
const token = localStorage.getItem('access_token');
const socket = io('/chat', {
  auth: { token },
});
```

---

## 1.5 多实例同步

### Redis 适配器概述

为支持水平扩展，聊天模块使用 `@socket.io/redis-adapter` 实现 WebSocket 事件的多实例同步。当部署多个后端实例时，通过 Redis 的 pub/sub 机制确保消息能广播到所有实例的客户端。

### 多实例同步架构图

```mermaid
flowchart TB
    subgraph Clients["客户端"]
        C1["Client A\n(Instance 1)"]
        C2["Client B\n(Instance 1)"]
        C3["Client C\n(Instance 2)"]
        C4["Client D\n(Instance 2)"]
    end

    subgraph LoadBalancer["负载均衡"]
        LB["Nginx / ALB"]
    end

    subgraph Instance1["后端实例 1"]
        GW1["ChatGateway"]
        Pub1["pubClient"]
        Sub1["subClient"]
    end

    subgraph Instance2["后端实例 2"]
        GW2["ChatGateway"]
        Pub2["pubClient"]
        Sub2["subClient"]
    end

    subgraph Redis["Redis Cluster"]
        R1[("Redis\nPub/Sub")]
    end

    C1 --> LB
    C2 --> LB
    C3 --> LB
    C4 --> LB

    LB -->|WebSocket| GW1
    LB -->|WebSocket| GW2

    GW1 <--> Pub1
    GW1 <--> Sub1
    GW2 <--> Pub2
    GW2 <--> Sub2

    Pub1 <--> R1
    Sub1 <--> R1
    Pub2 <--> R1
    Sub2 <--> R1

    style R1 fill:#f96,stroke:#333
```

### 同步流程说明

1. **Client A** 发送消息到 **Instance 1**
2. **Instance 1** 的 `ChatGateway` 处理消息
3. 消息通过 **pubClient** 发布到 Redis 频道
4. **Instance 2** 的 **subClient** 收到消息
5. **Instance 2** 的 `ChatGateway` 广播消息给 **Client C** 和 **Client D**

### RedisIoAdapter 实现

**文件:** `apps/backend/src/adapters/redis-io.adapter.ts`

```typescript
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);

  createIOServer(port: number, options?: ServerOptions): any {
    // 1. 创建标准 Socket.IO server
    const server = super.createIOServer(port, options);

    // 2. 获取 Redis 连接配置
    const redisUrl = getRedisUrl(); // 从 REDIS_URL 环境变量读取
    const redisOptions = parseRedisUrl(redisUrl);

    this.logger.log(`Connecting to Redis at ${redisOptions.host}:${redisOptions.port}`);

    // 3. 创建 pub/sub 客户端
    const pubClient = new Redis(redisOptions);
    const subClient = pubClient.duplicate();

    // 4. 监听连接事件
    pubClient.on('connect', () => this.logger.log('Redis pub client connected'));
    pubClient.on('error', (err) => this.logger.error('Redis pub client error:', err.message));
    subClient.on('connect', () => this.logger.log('Redis sub client connected'));
    subClient.on('error', (err) => this.logger.error('Redis sub client error:', err.message));

    // 5. 创建并设置 Redis adapter
    const redisAdapter = createAdapter(pubClient, subClient);
    server.adapter(redisAdapter);

    this.logger.log('Redis Socket.IO adapter initialized');

    return server;
  }
}
```

### 适配器注册

在 `main.ts` 中注册 Redis 适配器：

```typescript
const redisIoAdapter = new RedisIoAdapter(app);
app.useWebSocketAdapter(redisIoAdapter);
```

### 环境配置

| 环境变量    | 默认值                   | 说明           |
| ----------- | ------------------------ | -------------- |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接 URL |

**支持格式:**

- 本地: `redis://localhost:6379`
- 带密码: `redis://:password@host:6379`
- Redis Sentinel: 通过 `parseRedisUrl` 解析复杂配置

### 广播机制

当调用 `broadcastToRoom()` 时，消息通过 Redis adapter 同步到所有实例：

**文件:** `apps/backend/src/chat/chat.gateway.ts:351-354`

```typescript
broadcastToRoom(roomId: string, event: string, data: unknown): void {
  // server.to() 通过 Redis adapter 广播到所有实例
  this.server.to(`room:${roomId}`).emit(event, data);
}
```

### Redis 数据流

```
Instance 1: server.to('room:123').emit('newMessage', data)
    ↓
pubClient.publish('socket.io#room:123#', encodedData)
    ↓
Redis: 消息广播到所有订阅者
    ↓
Instance 2: subClient 接收消息
    ↓
Instance 2: 解码并 emit 给本地连接的 socket
```

---

## 1.6 消息队列架构

### Bull 队列配置

聊天模块使用 Bull 队列处理异步任务，主要解决以下场景：

- 离线消息通知
- 解耦消息处理与实时推送

### 队列任务类型

**文件:** `apps/backend/src/chat/queue/message.processor.ts`

```typescript
interface ChatJobData {
  type: 'send_message' | 'edit_message' | 'recall_message' | 'mark_read';
  messageId?: string;
  roomId?: string;
  userId?: string;
  content?: string;
  messageType?: MessageType;
  metadata?: Record<string, unknown>;
  replyToId?: string;
  timestamp: number;
}
```

### 队列处理流程

```mermaid
flowchart LR
    subgraph Producer["生产者"]
        ChatService["ChatService.sendMessage()"]
    end

    subgraph Queue["Bull Queue"]
        MESSAGE_QUEUE["MESSAGE_QUEUE\n(Redis backed)"]
    end

    subgraph Consumer["消费者"]
        MessageProcessor["MessageProcessor"]
        MessageEvents["MessageEvents"]
    end

    subgraph Actions["处理动作"]
        GetMembers["获取房间成员"]
        CheckOnline["检查在线状态"]
        CreateNotify["创建离线通知"]
    end

    ChatService -->|"job.add('send_message')"| MESSAGE_QUEUE
    MESSAGE_QUEUE --> MessageProcessor
    MessageProcessor --> GetMembers
    GetMembers --> CheckOnline
    CheckOnline -->|离线用户| CreateNotify
    MESSAGE_QUEUE -.->|事件| MessageEvents
```

### send_message 处理逻辑

**文件:** `apps/backend/src/chat/queue/message.processor.ts`

```typescript
@Process('send_message')
async handleSendMessage(job: Job<ChatJobData>) {
  const { roomId, userId: senderId } = job.data;

  // 1. 获取房间所有成员
  const members = await this.roomService.getMembers(roomId);

  // 2. 排除发送者
  const recipientIds = members
    .map((m) => m.userId)
    .filter((id) => id !== senderId);

  // 3. 检查在线状态
  const onlineUsers = await this.presenceService.getOnlineUsers(recipientIds);
  const onlineSet = new Set(onlineUsers.map((u) => u.userId));

  // 4. 为离线用户创建通知
  for (const recipientId of recipientIds) {
    if (!onlineSet.has(recipientId)) {
      await this.notificationService.create({
        userId: recipientId,
        type: NotificationType.MESSAGE,
        // ... 其他字段
      });
    }
  }
}
```

### 队列事件监听

**文件:** `apps/backend/src/chat/queue/message.events.ts`

| 装饰器                | 回调          | 说明                               |
| --------------------- | ------------- | ---------------------------------- |
| `@OnQueueActive()`    | `onActive`    | 任务开始处理                       |
| `@OnQueueCompleted()` | `onCompleted` | 任务完成                           |
| `@OnQueueFailed()`    | `onFailed`    | 任务失败 (重试 3 次后记录详细错误) |

---

## 1.7 在线状态管理

### PresenceService 架构

在线状态使用 Redis 缓存实现，支持快速查询和自动过期。

### 数据结构

```typescript
interface PresenceData {
  status: 'online' | 'offline';
  lastActiveAt: string; // ISO 8601
}
```

**Redis 存储:**

- Key: `presence:{userId}`
- TTL: 60 秒
- Value: JSON.stringify(PresenceData)

### 状态管理流程

```mermaid
stateDiagram-v2
    [*] --> Offline: 初始状态
    Offline --> Online: WebSocket 连接成功
    Online --> Online: heartbeat() 刷新 TTL
    Online --> Offline: WebSocket 断开
    Online --> Offline: TTL 过期 (60s 无心跳)
```

### 关键方法

**文件:** `apps/backend/src/chat/services/presence.service.ts`

| 方法                        | 说明     | Redis 操作                     |
| --------------------------- | -------- | ------------------------------ |
| `setOnline(userId)`         | 设置在线 | `SET presence:{userId} TTL=60` |
| `setOffline(userId)`        | 设置离线 | `DEL presence:{userId}`        |
| `heartbeat(userId)`         | 刷新 TTL | `EXPIRE presence:{userId} 60`  |
| `getOnlineStatus(userId)`   | 获取状态 | `GET presence:{userId}`        |
| `getOnlineUsers(userIds[])` | 批量查询 | `MGET presence:{userId1} ...`  |
| `isUserOnline(userId)`      | 检查在线 | `EXISTS presence:{userId}`     |

---

## 1.8 扩展性设计

### 水平扩展能力

| 组件            | 扩展方式               | 说明             |
| --------------- | ---------------------- | ---------------- |
| ChatGateway     | 无状态 + Redis Adapter | 可任意增加实例   |
| ChatService     | 无状态                 | 可任意增加实例   |
| PresenceService | Redis 共享             | 数据存储在 Redis |
| MessageQueue    | Bull + Redis           | 自动负载均衡     |

### 扩展注意事项

1. **WebSocket 连接数**: 单实例连接数受限于文件描述符，建议配置 `ulimit -n 65535`
2. **Redis 连接池**: 高并发时需要调整 ioredis 连接池配置
3. **消息顺序**: Bull 队列不保证严格顺序，需要业务层处理幂等性
4. **在线状态延迟**: 60 秒 TTL 可能导致状态延迟，可根据业务调整

---

# 2. 数据模型

本章节描述聊天模块的数据库实体设计。使用 TypeORM 定义实体，PostgreSQL 作为存储后端。

## 2.1 实体关系图

```mermaid
erDiagram
    User ||--o{ Room : "owns"
    User ||--o{ RoomMember : "joins"
    User ||--o{ Message : "sends"
    User ||--o{ MessageRead : "reads"

    Room ||--o{ RoomMember : "has"
    Room ||--o{ Message : "contains"

    Message ||--o{ MessageRead : "tracked_by"
    Message ||--o| Message : "replies_to"

    User {
        uuid id PK
        string username
        string email
        string password_hash
        string status
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }

    Room {
        uuid id PK
        enum type
        string name
        string avatar
        uuid owner_id FK
        timestamp last_message_at
        timestamp created_at
        timestamp updated_at
    }

    RoomMember {
        uuid id PK
        uuid room_id FK
        uuid user_id FK
        enum role
        timestamp last_read_at
        boolean muted
        timestamp joined_at
    }

    Message {
        uuid id PK
        uuid room_id FK
        uuid sender_id FK
        enum type
        text content
        jsonb metadata
        uuid reply_to_id FK
        timestamp edited_at
        timestamp deleted_at
        timestamp created_at
    }

    MessageRead {
        uuid id PK
        uuid message_id FK
        uuid user_id FK
        timestamp read_at
    }
```

## 2.2 Room 实体

房间是聊天的基本容器，支持私聊、群聊和广播三种类型。

### 表名

`chat_rooms`

### 字段定义

| 字段              | PostgreSQL 类型 | TypeScript 类型  | 约束                     | 说明                    |
| ----------------- | --------------- | ---------------- | ------------------------ | ----------------------- |
| `id`              | `uuid`          | `string`         | PK, AUTO                 | 主键，自动生成 UUID     |
| `type`            | `enum`          | `RoomType`       | INDEX, DEFAULT 'private' | 房间类型                |
| `name`            | `varchar(100)`  | `string \| null` | NULLABLE                 | 房间名称，私聊时为 null |
| `avatar`          | `varchar(500)`  | `string \| null` | NULLABLE                 | 头像 URL                |
| `owner_id`        | `uuid`          | `string \| null` | INDEX, NULLABLE, FK      | 房主 ID，私聊时为 null  |
| `last_message_at` | `timestamp`     | `Date`           | INDEX, DEFAULT NOW       | 最后消息时间，用于排序  |
| `created_at`      | `timestamp`     | `Date`           | AUTO                     | 创建时间                |
| `updated_at`      | `timestamp`     | `Date`           | AUTO                     | 更新时间                |

### 枚举类型

```typescript
export enum RoomType {
  PRIVATE = 'private', // 私聊：两人对话
  GROUP = 'group', // 群聊：多人会话
  BROADCAST = 'broadcast', // 广播：单向通知
}
```

### 索引设计

| 索引                       | 字段              | 类型   | 用途                   |
| -------------------------- | ----------------- | ------ | ---------------------- |
| `IDX_room_type`            | `type`            | B-tree | 按类型筛选房间         |
| `IDX_room_owner_id`        | `owner_id`        | B-tree | 查询用户拥有的群组     |
| `IDX_room_last_message_at` | `last_message_at` | B-tree | 房间列表按最新消息排序 |

### 关系定义

| 关系       | 类型      | 目标实体   | 说明         |
| ---------- | --------- | ---------- | ------------ |
| `owner`    | ManyToOne | User       | 房间拥有者   |
| `members`  | OneToMany | RoomMember | 房间成员列表 |
| `messages` | OneToMany | Message    | 房间消息列表 |

### TypeORM 实体代码

```typescript
@Entity('chat_rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({
    type: 'enum',
    enum: RoomType,
    default: RoomType.PRIVATE,
  })
  type: RoomType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatar: string | null;

  @Index()
  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @Index()
  @Column({ name: 'last_message_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastMessageAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations - use lazy import to avoid circular dependency
  @ManyToOne(() => require('./user.entity').User)
  @JoinColumn({ name: 'owner_id' })
  owner: import('./user.entity').User | null;

  @OneToMany('RoomMember', (member: any) => member.room)
  members: any[];

  @OneToMany('Message', (message: any) => message.room)
  messages: any[];
}
```

---

## 2.3 RoomMember 实体

房间成员关联表，记录用户与房间的关系及成员状态。

### 表名

`chat_room_members`

### 字段定义

| 字段           | PostgreSQL 类型 | TypeScript 类型  | 约束             | 说明         |
| -------------- | --------------- | ---------------- | ---------------- | ------------ |
| `id`           | `uuid`          | `string`         | PK, AUTO         | 主键         |
| `room_id`      | `uuid`          | `string`         | INDEX, FK        | 所属房间 ID  |
| `user_id`      | `uuid`          | `string`         | INDEX, FK        | 用户 ID      |
| `role`         | `enum`          | `RoomMemberRole` | DEFAULT 'member' | 成员角色     |
| `last_read_at` | `timestamp`     | `Date`           | DEFAULT NOW      | 最后已读时间 |
| `muted`        | `boolean`       | `boolean`        | DEFAULT false    | 是否静音     |
| `joined_at`    | `timestamp`     | `Date`           | AUTO             | 加入时间     |

### 枚举类型

```typescript
export enum RoomMemberRole {
  OWNER = 'owner', // 房主：完全控制权
  ADMIN = 'admin', // 管理员：可管理成员
  MEMBER = 'member', // 普通成员
}
```

### 索引设计

| 索引                       | 字段                 | 类型   | 用途             |
| -------------------------- | -------------------- | ------ | ---------------- |
| `IDX_room_member_room_id`  | `room_id`            | B-tree | 查询房间成员列表 |
| `IDX_room_member_user_id`  | `user_id`            | B-tree | 查询用户所在房间 |
| `UQ_room_member_room_user` | `(room_id, user_id)` | UNIQUE | 防止重复加入     |

### 关系定义

| 关系   | 类型      | 目标实体 | 说明     |
| ------ | --------- | -------- | -------- |
| `room` | ManyToOne | Room     | 所属房间 |
| `user` | ManyToOne | User     | 成员用户 |

### TypeORM 实体代码

```typescript
@Entity('chat_room_members')
@Index(['roomId', 'userId'], { unique: true })
export class RoomMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: RoomMemberRole,
    default: RoomMemberRole.MEMBER,
  })
  role: RoomMemberRole;

  @Column({ name: 'last_read_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastReadAt: Date;

  @Column({ type: 'boolean', default: false })
  muted: boolean;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  // Relations
  @ManyToOne(() => require('./room.entity').Room, (room: any) => room.members)
  @JoinColumn({ name: 'room_id' })
  room: import('./room.entity').Room;

  @ManyToOne(() => require('./user.entity').User)
  @JoinColumn({ name: 'user_id' })
  user: import('./user.entity').User;
}
```

### 未读计数机制

未读消息数量基于 `last_read_at` 字段计算：

```sql
SELECT COUNT(*)
FROM chat_messages m
WHERE m.room_id = :roomId
  AND m.created_at > :lastReadAt
  AND m.sender_id != :userId
  AND m.deleted_at IS NULL
```

---

## 2.4 Message 实体

消息实体，支持多种消息类型和软删除（撤回）。

### 表名

`chat_messages`

### 字段定义

| 字段          | PostgreSQL 类型 | TypeScript 类型                   | 约束                | 说明               |
| ------------- | --------------- | --------------------------------- | ------------------- | ------------------ |
| `id`          | `uuid`          | `string`                          | PK, AUTO            | 主键               |
| `room_id`     | `uuid`          | `string`                          | INDEX, FK           | 所属房间 ID        |
| `sender_id`   | `uuid`          | `string`                          | INDEX, FK           | 发送者 ID          |
| `type`        | `enum`          | `MessageType`                     | DEFAULT 'text'      | 消息类型           |
| `content`     | `text`          | `string`                          | NOT NULL            | 消息内容           |
| `metadata`    | `jsonb`         | `Record<string, unknown> \| null` | NULLABLE            | 附加元数据         |
| `reply_to_id` | `uuid`          | `string \| null`                  | INDEX, NULLABLE, FK | 回复的消息 ID      |
| `edited_at`   | `timestamp`     | `Date \| null`                    | NULLABLE            | 编辑时间           |
| `deleted_at`  | `timestamp`     | `Date \| null`                    | SOFT DELETE         | 软删除时间（撤回） |
| `created_at`  | `timestamp`     | `Date`                            | AUTO                | 创建时间           |

### 枚举类型

```typescript
export enum MessageType {
  TEXT = 'text', // 文本消息
  IMAGE = 'image', // 图片消息
  FILE = 'file', // 文件消息
  EMOJI = 'emoji', // 表情消息
  SYSTEM = 'system', // 系统消息（入群、退群通知等）
}
```

### 索引设计

| 索引                       | 字段                    | 类型      | 用途               |
| -------------------------- | ----------------------- | --------- | ------------------ |
| `IDX_message_room_id`      | `room_id`               | B-tree    | 按房间查询消息     |
| `IDX_message_sender_id`    | `sender_id`             | B-tree    | 查询用户发送的消息 |
| `IDX_message_reply_to_id`  | `reply_to_id`           | B-tree    | 查询消息的回复     |
| `IDX_message_room_created` | `(room_id, created_at)` | COMPOSITE | 分页查询优化       |

### 关系定义

| 关系      | 类型      | 目标实体    | 说明                   |
| --------- | --------- | ----------- | ---------------------- |
| `room`    | ManyToOne | Room        | 所属房间               |
| `sender`  | ManyToOne | User        | 发送者                 |
| `replyTo` | ManyToOne | Message     | 被回复的消息（自引用） |
| `reads`   | OneToMany | MessageRead | 已读记录               |

### 软删除机制

消息撤回使用 TypeORM 的 `@DeleteDateColumn` 实现软删除：

- 撤回时设置 `deleted_at` 为当前时间
- 查询时自动过滤 `deleted_at IS NOT NULL` 的记录
- 撤回限制：5 分钟内，仅发送者可撤回

### TypeORM 实体代码

```typescript
@Entity('chat_messages')
@Index(['roomId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @Index()
  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Index()
  @Column({ name: 'reply_to_id', type: 'uuid', nullable: true })
  replyToId: string | null;

  @Column({ name: 'edited_at', type: 'timestamp', nullable: true })
  editedAt: Date | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => require('./room.entity').Room, (room: any) => room.messages)
  @JoinColumn({ name: 'room_id' })
  room: import('./room.entity').Room;

  @ManyToOne(() => require('./user.entity').User)
  @JoinColumn({ name: 'sender_id' })
  sender: import('./user.entity').User;

  @ManyToOne(() => require('./message.entity').Message)
  @JoinColumn({ name: 'reply_to_id' })
  replyTo: import('./message.entity').Message | null;

  @OneToMany('MessageRead', (messageRead: any) => messageRead.message)
  reads: any[];
}
```

---

## 2.5 MessageRead 实体

消息已读记录，用于细粒度的已读回执追踪。

### 表名

`chat_message_reads`

### 字段定义

| 字段         | PostgreSQL 类型 | TypeScript 类型 | 约束      | 说明     |
| ------------ | --------------- | --------------- | --------- | -------- |
| `id`         | `uuid`          | `string`        | PK, AUTO  | 主键     |
| `message_id` | `uuid`          | `string`        | INDEX, FK | 消息 ID  |
| `user_id`    | `uuid`          | `string`        | INDEX, FK | 用户 ID  |
| `read_at`    | `timestamp`     | `Date`          | AUTO      | 已读时间 |

### 索引设计

| 索引                           | 字段                    | 类型   | 用途               |
| ------------------------------ | ----------------------- | ------ | ------------------ |
| `IDX_message_read_message_id`  | `message_id`            | B-tree | 查询消息的已读记录 |
| `IDX_message_read_user_id`     | `user_id`               | B-tree | 查询用户的已读消息 |
| `UQ_message_read_message_user` | `(message_id, user_id)` | UNIQUE | 防止重复记录       |

### 关系定义

| 关系      | 类型      | 目标实体 | 说明     |
| --------- | --------- | -------- | -------- |
| `message` | ManyToOne | Message  | 关联消息 |
| `user`    | ManyToOne | User     | 已读用户 |

### TypeORM 实体代码

```typescript
@Entity('chat_message_reads')
@Index(['messageId', 'userId'], { unique: true })
export class MessageRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @CreateDateColumn({ name: 'read_at' })
  readAt: Date;

  // Relations
  @ManyToOne(() => require('./message.entity').Message, (message: any) => message.reads)
  @JoinColumn({ name: 'message_id' })
  message: import('./message.entity').Message;

  @ManyToOne(() => require('./user.entity').User)
  @JoinColumn({ name: 'user_id' })
  user: import('./user.entity').User;
}
```

### 当前状态

> **注意**: 当前实现使用 `RoomMember.lastReadAt` 进行 per-room 级别的未读计数。`MessageRead` 实体已定义但 `markRead` 流程尚未使用此实体。如需实现细粒度的 per-message 已读回执，需要完善 `MessageService.markAsRead()` 方法的调用链。

---

## 2.6 索引设计说明

### 索引策略

#### 1. 主键索引

所有表使用 UUID 主键，自动创建 B-tree 索引：

```sql
PRIMARY KEY (id) -- 自动创建唯一索引
```

#### 2. 外键索引

所有外键字段创建单列索引，优化 JOIN 查询性能：

```sql
CREATE INDEX IDX_room_member_room_id ON chat_room_members(room_id);
CREATE INDEX IDX_room_member_user_id ON chat_room_members(user_id);
CREATE INDEX IDX_message_room_id ON chat_messages(room_id);
CREATE INDEX IDX_message_sender_id ON chat_messages(sender_id);
```

#### 3. 复合索引

针对高频查询场景设计复合索引：

| 索引                           | 表                 | 字段                    | 查询场景                  |
| ------------------------------ | ------------------ | ----------------------- | ------------------------- |
| `IDX_message_room_created`     | chat_messages      | `(room_id, created_at)` | 消息分页查询              |
| `UQ_room_member_room_user`     | chat_room_members  | `(room_id, user_id)`    | 成员唯一性 + 房间成员查询 |
| `UQ_message_read_message_user` | chat_message_reads | `(message_id, user_id)` | 已读记录唯一性            |

#### 4. 排序索引

支持列表排序的索引：

```sql
CREATE INDEX IDX_room_last_message_at ON chat_rooms(last_message_at DESC);
-- 用于房间列表按最新消息排序
```

### 性能考虑

#### 消息分页查询优化

```sql
-- 使用复合索引 IDX_message_room_created
SELECT * FROM chat_messages
WHERE room_id = :roomId
  AND created_at < :cursor
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT :limit;
```

#### 未读计数查询

```sql
-- 利用 last_read_at 字段，避免全表扫描
SELECT COUNT(*) FROM chat_messages m
WHERE m.room_id = :roomId
  AND m.created_at > (
    SELECT last_read_at FROM chat_room_members
    WHERE room_id = :roomId AND user_id = :userId
  )
  AND m.sender_id != :userId
  AND m.deleted_at IS NULL;
```

#### 建议的额外索引

如果消息量增长，可考虑添加以下索引：

```sql
-- 按类型筛选消息
CREATE INDEX IDX_message_type ON chat_messages(type);

-- 全文搜索（PostgreSQL）
CREATE INDEX IDX_message_content_search ON chat_messages USING gin(to_tsvector('simple', content));
```

---

## 2.7 数据完整性约束

### 外键约束

```sql
-- RoomMember 外键
ALTER TABLE chat_room_members
  ADD CONSTRAINT FK_room_member_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  ADD CONSTRAINT FK_room_member_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Message 外键
ALTER TABLE chat_messages
  ADD CONSTRAINT FK_message_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
  ADD CONSTRAINT FK_message_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT FK_message_reply_to FOREIGN KEY (reply_to_id) REFERENCES chat_messages(id) ON DELETE SET NULL;

-- MessageRead 外键
ALTER TABLE chat_message_reads
  ADD CONSTRAINT FK_message_read_message FOREIGN KEY (message_id) REFERENCES chat_messages(id) ON DELETE CASCADE,
  ADD CONSTRAINT FK_message_read_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
```

### 唯一性约束

```sql
-- 防止用户重复加入同一房间
ALTER TABLE chat_room_members
  ADD CONSTRAINT UQ_room_member_room_user UNIQUE (room_id, user_id);

-- 防止重复的已读记录
ALTER TABLE chat_message_reads
  ADD CONSTRAINT UQ_message_read_message_user UNIQUE (message_id, user_id);
```

---

# 3. API 参考

## 3.1 概述

### 基础信息

| 项目               | 值               |
| ------------------ | ---------------- |
| REST API 基础路径  | `/api/v1/chat`   |
| WebSocket 命名空间 | `/chat`          |
| 认证方式           | JWT Bearer Token |

### 认证说明

所有 REST API 端点均需要 JWT 认证。在请求头中添加：

```
Authorization: Bearer <your_jwt_token>
```

WebSocket 连接认证支持两种方式：

1. **Query 参数**: `ws://host/chat?token=<your_jwt_token>`
2. **Auth Header**: 在 WebSocket 握手时设置 `Authorization: Bearer <token>`

### 通用响应格式

#### 成功响应

```json
{
  "data": { ... }
}
```

#### 错误响应

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

---

## 3.2 REST API

### 3.2.1 房间管理

#### POST /rooms - 创建房间

创建新的聊天房间。创建者会自动成为房间成员。

**请求体**

```json
{
  "type": "group",
  "name": "Team Discussion",
  "avatar": "https://example.com/avatar.png",
  "memberIds": ["550e8400-e29b-41d4-a716-446655440001"]
}
```

| 字段        | 类型     | 必填     | 说明                                      |
| ----------- | -------- | -------- | ----------------------------------------- |
| `type`      | enum     | 是       | 房间类型: `private`, `group`, `broadcast` |
| `name`      | string   | 群聊必填 | 房间名称，1-100 字符                      |
| `avatar`    | string   | 否       | 头像 URL，最大 500 字符                   |
| `memberIds` | string[] | 否       | 初始成员 ID 数组 (UUID v4)                |

**房间类型说明**

| 类型        | 说明                                  |
| ----------- | ------------------------------------- |
| `private`   | 私聊，仅两人，name 为空，ownerId 为空 |
| `group`     | 群聊，需要 name，创建者为 owner       |
| `broadcast` | 广播房间，单向消息                    |

**响应** - 201 Created

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "group",
  "name": "Team Discussion",
  "avatar": "https://example.com/avatar.png",
  "ownerId": "550e8400-e29b-41d4-a716-446655440002",
  "lastMessageAt": "2026-03-14T10:30:00.000Z",
  "createdAt": "2026-03-14T10:30:00.000Z",
  "updatedAt": "2026-03-14T10:30:00.000Z"
}
```

**curl 示例**

```bash
curl -X POST "https://api.example.com/api/v1/chat/rooms" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "group",
    "name": "Team Discussion",
    "memberIds": ["550e8400-e29b-41d4-a716-446655440001"]
  }'
```

---

#### GET /rooms - 获取房间列表

获取当前用户加入的所有房间，包含未读消息计数。

**请求参数**

无

**响应** - 200 OK

```json
{
  "data": [
    {
      "room": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "type": "group",
        "name": "Team Discussion",
        "avatar": "https://example.com/avatar.png",
        "ownerId": "550e8400-e29b-41d4-a716-446655440002",
        "lastMessageAt": "2026-03-14T12:00:00.000Z",
        "createdAt": "2026-03-14T10:30:00.000Z",
        "updatedAt": "2026-03-14T12:00:00.000Z"
      },
      "role": "owner",
      "unreadCount": 5,
      "lastReadAt": "2026-03-14T11:00:00.000Z"
    }
  ]
}
```

**curl 示例**

```bash
curl -X GET "https://api.example.com/api/v1/chat/rooms" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### GET /rooms/:id/messages - 获取历史消息

使用游标分页获取房间消息。用户必须是房间成员。

**路径参数**

| 参数 | 类型 | 说明    |
| ---- | ---- | ------- |
| `id` | UUID | 房间 ID |

**查询参数**

| 参数     | 类型 | 必填 | 默认值 | 说明               |
| -------- | ---- | ---- | ------ | ------------------ |
| `cursor` | UUID | 否   | -      | 分页游标 (消息 ID) |
| `limit`  | int  | 否   | 20     | 每页数量，1-100    |
| `order`  | enum | 否   | DESC   | 排序方向: ASC/DESC |

**响应** - 200 OK

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "roomId": "550e8400-e29b-41d4-a716-446655440000",
      "senderId": "550e8400-e29b-41d4-a716-446655440002",
      "type": "text",
      "content": "Hello everyone!",
      "metadata": null,
      "replyToId": null,
      "editedAt": null,
      "deletedAt": null,
      "createdAt": "2026-03-14T12:00:00.000Z"
    }
  ],
  "nextCursor": "550e8400-e29b-41d4-a716-446655440009",
  "hasMore": true
}
```

**分页说明**

- `nextCursor`: 下一页起始消息 ID，为 `null` 表示没有更多数据
- `hasMore`: 是否还有更多消息
- 默认按时间倒序 (最新消息在前)

**curl 示例**

```bash
curl -X GET "https://api.example.com/api/v1/chat/rooms/550e8400-e29b-41d4-a716-446655440000/messages?limit=20&order=DESC" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

#### POST /rooms/:id/members - 添加成员

向群聊房间添加新成员。需要是房间管理员或拥有者。

**路径参数**

| 参数 | 类型 | 说明    |
| ---- | ---- | ------- |
| `id` | UUID | 房间 ID |

**请求体**

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440003"
}
```

| 字段     | 类型 | 必填 | 说明            |
| -------- | ---- | ---- | --------------- |
| `userId` | UUID | 是   | 要添加的用户 ID |

**响应** - 201 Created

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440020",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "userId": "550e8400-e29b-41d4-a716-446655440003",
  "role": "member",
  "joinedAt": "2026-03-14T13:00:00.000Z",
  "lastReadAt": "2026-03-14T13:00:00.000Z"
}
```

**错误响应**

| 状态码 | 说明             |
| ------ | ---------------- |
| 403    | 无权限添加成员   |
| 409    | 用户已是房间成员 |

**curl 示例**

```bash
curl -X POST "https://api.example.com/api/v1/chat/rooms/550e8400-e29b-41d4-a716-446655440000/members" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "550e8400-e29b-41d4-a716-446655440003"}'
```

---

### 3.2.2 消息管理

#### PATCH /messages/:id - 编辑消息

编辑已发送的消息。只有消息发送者可以编辑。

**路径参数**

| 参数 | 类型 | 说明    |
| ---- | ---- | ------- |
| `id` | UUID | 消息 ID |

**请求体**

```json
{
  "content": "Updated message content"
}
```

| 字段      | 类型   | 必填 | 说明                     |
| --------- | ------ | ---- | ------------------------ |
| `content` | string | 是   | 新消息内容，1-10000 字符 |

**响应** - 200 OK

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "senderId": "550e8400-e29b-41d4-a716-446655440002",
  "type": "text",
  "content": "Updated message content",
  "metadata": null,
  "replyToId": null,
  "editedAt": "2026-03-14T14:00:00.000Z",
  "deletedAt": null,
  "createdAt": "2026-03-14T12:00:00.000Z"
}
```

**错误响应**

| 状态码 | 说明               |
| ------ | ------------------ |
| 400    | 消息不存在         |
| 403    | 只能编辑自己的消息 |

**curl 示例**

```bash
curl -X PATCH "https://api.example.com/api/v1/chat/messages/550e8400-e29b-41d4-a716-446655440010" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated message content"}'
```

---

#### DELETE /messages/:id - 撤回消息

撤回已发送的消息 (软删除)。只有发送者可以在发送后 5 分钟内撤回。

**路径参数**

| 参数 | 类型 | 说明    |
| ---- | ---- | ------- |
| `id` | UUID | 消息 ID |

**请求体**

无

**响应** - 200 OK

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440010",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "senderId": "550e8400-e29b-41d4-a716-446655440002",
  "type": "text",
  "content": null,
  "metadata": null,
  "replyToId": null,
  "editedAt": null,
  "deletedAt": "2026-03-14T12:04:00.000Z",
  "createdAt": "2026-03-14T12:00:00.000Z"
}
```

**撤回规则**

- 时间限制: 发送后 5 分钟内
- 权限: 仅发送者可撤回
- 实现方式: 软删除 (`deletedAt` 字段)

**错误响应**

| 状态码 | 说明                                  |
| ------ | ------------------------------------- |
| 400    | 消息不存在或已撤回                    |
| 403    | 只能撤回自己的消息，或超过 5 分钟限制 |

**curl 示例**

```bash
curl -X DELETE "https://api.example.com/api/v1/chat/messages/550e8400-e29b-41d4-a716-446655440010" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 3.3 WebSocket 事件

### 3.3.1 连接认证

#### 连接流程

```
客户端                                    服务端
   |                                        |
   |------ connect (with token) ----------->|
   |                                        | 验证 JWT
   |                                        | 设置在线状态
   |<----- connection event ----------------|
   |                                        |
```

#### connection - 连接成功

**方向**: Server → Client

**Payload**

```json
{
  "message": "Connected to chat",
  "userId": "550e8400-e29b-41d4-a716-446655440002",
  "timestamp": "2026-03-14T10:30:00.000Z"
}
```

#### error - 认证失败

**方向**: Server → Client

**Payload**

```json
{
  "message": "Invalid or expired token"
}
```

**连接代码示例**

```javascript
import { io } from 'socket.io-client';

const socket = io('ws://localhost:3000/chat', {
  auth: {
    token: 'your_jwt_token',
  },
  // 或者使用 query 参数
  // query: { token: 'your_jwt_token' }
});

socket.on('connection', (data) => {
  console.log('Connected:', data);
});

socket.on('error', (error) => {
  console.error('Connection error:', error);
});
```

---

### 3.3.2 客户端事件

#### joinRoom - 加入房间

**方向**: Client → Server

**Payload**

```json
{
  "roomId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**响应**

```json
{
  "success": true,
  "roomId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**触发事件**: 服务端会向房间其他成员广播 `userJoined` 事件

**代码示例**

```javascript
socket.emit('joinRoom', { roomId: 'room-uuid' }, (response) => {
  if (response.success) {
    console.log('Joined room:', response.roomId);
  }
});
```

---

#### leaveRoom - 离开房间

**方向**: Client → Server

**Payload**

```json
{
  "roomId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**响应**

```json
{
  "success": true,
  "roomId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**触发事件**: 服务端会向房间其他成员广播 `userLeft` 事件

**代码示例**

```javascript
socket.emit('leaveRoom', { roomId: 'room-uuid' }, (response) => {
  console.log('Left room:', response.roomId);
});
```

---

#### sendMessage - 发送消息

**方向**: Client → Server

**Payload**

```json
{
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "content": "Hello everyone!",
  "type": "text",
  "metadata": {
    "mentions": ["550e8400-e29b-41d4-a716-446655440003"]
  },
  "replyToId": "550e8400-e29b-41d4-a716-446655440009"
}
```

| 字段        | 类型   | 必填 | 默认值 | 说明                                   |
| ----------- | ------ | ---- | ------ | -------------------------------------- |
| `roomId`    | UUID   | 是   | -      | 目标房间 ID                            |
| `content`   | string | 是   | -      | 消息内容                               |
| `type`      | enum   | 否   | text   | 消息类型: text/image/file/emoji/system |
| `metadata`  | object | 否   | -      | 附加元数据                             |
| `replyToId` | UUID   | 否   | -      | 回复的消息 ID                          |

**响应**

```json
{
  "success": true,
  "messageId": "550e8400-e29b-41d4-a716-446655440010"
}
```

**消息类型说明**

| 类型     | 说明                               |
| -------- | ---------------------------------- |
| `text`   | 文本消息                           |
| `image`  | 图片消息 (metadata 中包含 URL)     |
| `file`   | 文件消息 (metadata 中包含文件信息) |
| `emoji`  | 表情消息                           |
| `system` | 系统消息                           |

**代码示例**

```javascript
socket.emit(
  'sendMessage',
  {
    roomId: 'room-uuid',
    content: 'Hello!',
    type: 'text',
  },
  (response) => {
    console.log('Message sent:', response.messageId);
  }
);
```

---

#### editMessage - 编辑消息

**方向**: Client → Server

**Payload**

```json
{
  "messageId": "550e8400-e29b-41d4-a716-446655440010",
  "content": "Updated message content"
}
```

| 字段        | 类型   | 必填 | 说明            |
| ----------- | ------ | ---- | --------------- |
| `messageId` | UUID   | 是   | 要编辑的消息 ID |
| `content`   | string | 是   | 新消息内容      |

**响应**

```json
{
  "success": true,
  "messageId": "550e8400-e29b-41d4-a716-446655440010"
}
```

**代码示例**

```javascript
socket.emit(
  'editMessage',
  {
    messageId: 'message-uuid',
    content: 'Updated content',
  },
  (response) => {
    console.log('Message edited:', response.messageId);
  }
);
```

---

#### typing - 输入状态

**方向**: Client → Server

**Payload**

```json
{
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "isTyping": true
}
```

| 字段       | 类型    | 必填 | 说明         |
| ---------- | ------- | ---- | ------------ |
| `roomId`   | UUID    | 是   | 房间 ID      |
| `isTyping` | boolean | 是   | 是否正在输入 |

**响应**: 无直接响应，服务端会广播 `userTyping` 事件

**代码示例**

```javascript
// 用户开始输入
socket.emit('typing', { roomId: 'room-uuid', isTyping: true });

// 用户停止输入
socket.emit('typing', { roomId: 'room-uuid', isTyping: false });
```

---

#### markRead - 标记已读

**方向**: Client → Server

**Payload**

```json
{
  "roomId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| 字段     | 类型 | 必填 | 说明    |
| -------- | ---- | ---- | ------- |
| `roomId` | UUID | 是   | 房间 ID |

**响应**

```json
{
  "success": true,
  "roomId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**触发事件**: 服务端会向房间其他成员广播 `messagesRead` 事件

**说明**: 标记已读会更新用户的 `lastReadAt` 时间戳，影响未读计数

**代码示例**

```javascript
socket.emit('markRead', { roomId: 'room-uuid' }, (response) => {
  console.log('Marked as read:', response.roomId);
});
```

---

### 3.3.3 服务端广播事件

#### userJoined - 用户加入房间

**方向**: Server → Room (房间内所有成员，不包括加入者)

**触发时机**: 用户通过 `joinRoom` 加入房间后

**Payload**

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440002",
  "username": "john_doe",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-14T10:30:00.000Z"
}
```

**监听示例**

```javascript
socket.on('userJoined', (data) => {
  console.log(`${data.username} joined the room`);
  // 更新 UI 显示用户加入
});
```

---

#### userLeft - 用户离开房间

**方向**: Server → Room (房间内剩余成员)

**触发时机**: 用户通过 `leaveRoom` 离开房间后

**Payload**

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440002",
  "username": "john_doe",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-14T11:00:00.000Z"
}
```

**监听示例**

```javascript
socket.on('userLeft', (data) => {
  console.log(`${data.username} left the room`);
  // 更新 UI 显示用户离开
});
```

---

#### userTyping - 用户输入状态

**方向**: Server → Room (房间内其他成员)

**触发时机**: 用户发送 `typing` 事件后

**Payload**

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440002",
  "username": "john_doe",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "isTyping": true,
  "timestamp": "2026-03-14T10:30:00.000Z"
}
```

**监听示例**

```javascript
socket.on('userTyping', (data) => {
  if (data.isTyping) {
    showTypingIndicator(data.username);
  } else {
    hideTypingIndicator(data.username);
  }
});
```

---

#### messagesRead - 消息已读

**方向**: Server → Room (房间内其他成员)

**触发时机**: 用户发送 `markRead` 事件后

**Payload**

```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440002",
  "username": "john_doe",
  "roomId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-03-14T10:30:00.000Z"
}
```

**监听示例**

```javascript
socket.on('messagesRead', (data) => {
  console.log(`${data.username} read messages in room ${data.roomId}`);
  // 更新已读状态显示
});
```

---

## 3.4 数据类型

### 3.4.1 请求类型

#### CreateRoomDto

```typescript
interface CreateRoomDto {
  /** 房间类型: private | group | broadcast */
  type: RoomType;

  /** 房间名称 (群聊必填)，1-100 字符 */
  name?: string;

  /** 头像 URL，最大 500 字符 */
  avatar?: string;

  /** 初始成员 ID 数组 */
  memberIds?: string[];
}

type RoomType = 'private' | 'group' | 'broadcast';
```

#### AddMemberDto

```typescript
interface AddMemberDto {
  /** 要添加的用户 ID (UUID v4) */
  userId: string;
}
```

#### EditMessageDto

```typescript
interface EditMessageDto {
  /** 新消息内容，1-10000 字符 */
  content: string;
}
```

#### MessageQueryDto

```typescript
interface MessageQueryDto {
  /** 分页游标 (消息 ID) */
  cursor?: string;

  /** 每页数量，1-100，默认 20 */
  limit?: number;

  /** 排序方向，ASC | DESC，默认 DESC */
  order?: 'ASC' | 'DESC';
}
```

#### SendMessagePayload

```typescript
interface SendMessagePayload {
  /** 目标房间 ID */
  roomId: string;

  /** 消息内容 */
  content: string;

  /** 消息类型，默认 text */
  type?: MessageType;

  /** 附加元数据 */
  metadata?: Record<string, unknown>;

  /** 回复的消息 ID */
  replyToId?: string;
}

type MessageType = 'text' | 'image' | 'file' | 'emoji' | 'system';
```

#### EditMessagePayload

```typescript
interface EditMessagePayload {
  /** 要编辑的消息 ID */
  messageId: string;

  /** 新消息内容 */
  content: string;
}
```

#### TypingPayload

```typescript
interface TypingPayload {
  /** 房间 ID */
  roomId: string;

  /** 是否正在输入 */
  isTyping: boolean;
}
```

#### MarkReadPayload

```typescript
interface MarkReadPayload {
  /** 房间 ID */
  roomId: string;
}
```

---

### 3.4.2 响应类型

#### RoomResponse

```typescript
interface RoomResponse {
  /** 房间 ID */
  id: string;

  /** 房间类型 */
  type: RoomType;

  /** 房间名称 (私聊为 null) */
  name: string | null;

  /** 头像 URL */
  avatar: string | null;

  /** 房主 ID (私聊为 null) */
  ownerId: string | null;

  /** 最后消息时间 */
  lastMessageAt: Date;

  /** 创建时间 */
  createdAt: Date;

  /** 更新时间 */
  updatedAt: Date;
}
```

#### UserRoomResponse

```typescript
interface UserRoomResponse {
  /** 房间信息 */
  room: RoomResponse;

  /** 用户在房间中的角色: owner | admin | member */
  role: string;

  /** 未读消息数 */
  unreadCount: number;

  /** 最后已读时间 */
  lastReadAt: Date;
}
```

#### RoomListResponse

```typescript
interface RoomListResponse {
  /** 房间列表 */
  data: UserRoomResponse[];
}
```

#### MessageResponse

```typescript
interface MessageResponse {
  /** 消息 ID */
  id: string;

  /** 所属房间 ID */
  roomId: string;

  /** 发送者 ID */
  senderId: string;

  /** 消息类型 */
  type: string;

  /** 消息内容 (撤回后为 null) */
  content: string | null;

  /** 附加元数据 */
  metadata: Record<string, unknown> | null;

  /** 回复的消息 ID */
  replyToId: string | null;

  /** 编辑时间 (未编辑为 null) */
  editedAt: Date | null;

  /** 撤回时间 (未撤回为 null) */
  deletedAt: Date | null;

  /** 创建时间 */
  createdAt: Date;
}
```

#### MessageListResponse

```typescript
interface MessageListResponse {
  /** 消息列表 */
  data: MessageResponse[];

  /** 下一页游标 (无更多数据时为 null) */
  nextCursor: string | null;

  /** 是否还有更多消息 */
  hasMore: boolean;
}
```

#### MemberResponse

```typescript
interface MemberResponse {
  /** 成员记录 ID */
  id: string;

  /** 房间 ID */
  roomId: string;

  /** 用户 ID */
  userId: string;

  /** 角色: owner | admin | member */
  role: string;

  /** 加入时间 */
  joinedAt: Date;

  /** 最后已读时间 */
  lastReadAt: Date;
}
```

---

### 3.4.3 枚举类型

#### RoomType

```typescript
enum RoomType {
  /** 私聊 - 仅两人 */
  PRIVATE = 'private',

  /** 群聊 - 多人 */
  GROUP = 'group',

  /** 广播 - 单向消息 */
  BROADCAST = 'broadcast',
}
```

#### MessageType

```typescript
enum MessageType {
  /** 文本消息 */
  TEXT = 'text',

  /** 图片消息 */
  IMAGE = 'image',

  /** 文件消息 */
  FILE = 'file',

  /** 表情消息 */
  EMOJI = 'emoji',

  /** 系统消息 */
  SYSTEM = 'system',
}
```

#### MemberRole

```typescript
enum MemberRole {
  /** 房主 - 群聊创建者 */
  OWNER = 'owner',

  /** 管理员 - 可管理成员 */
  ADMIN = 'admin',

  /** 普通成员 */
  MEMBER = 'member',
}
```

---

## 3.5 API 端点汇总

### REST API 端点列表

| 方法   | 端点                              | 说明         | 认证 |
| ------ | --------------------------------- | ------------ | ---- |
| POST   | `/api/v1/chat/rooms`              | 创建房间     | JWT  |
| GET    | `/api/v1/chat/rooms`              | 获取房间列表 | JWT  |
| GET    | `/api/v1/chat/rooms/:id/messages` | 获取历史消息 | JWT  |
| POST   | `/api/v1/chat/rooms/:id/members`  | 添加成员     | JWT  |
| PATCH  | `/api/v1/chat/messages/:id`       | 编辑消息     | JWT  |
| DELETE | `/api/v1/chat/messages/:id`       | 撤回消息     | JWT  |

### WebSocket 事件列表

#### 客户端事件 (Client → Server)

| 事件          | 说明     | 需要加入房间 |
| ------------- | -------- | ------------ |
| `joinRoom`    | 加入房间 | 否           |
| `leaveRoom`   | 离开房间 | 是           |
| `sendMessage` | 发送消息 | 是           |
| `editMessage` | 编辑消息 | 是           |
| `typing`      | 输入状态 | 是           |
| `markRead`    | 标记已读 | 是           |

#### 服务端事件 (Server → Client)

| 事件           | 方向            | 说明          |
| -------------- | --------------- | ------------- |
| `connection`   | Server → Client | 连接成功      |
| `error`        | Server → Client | 认证失败/错误 |
| `userJoined`   | Server → Room   | 用户加入房间  |
| `userLeft`     | Server → Room   | 用户离开房间  |
| `userTyping`   | Server → Room   | 输入状态变化  |
| `messagesRead` | Server → Room   | 消息已读      |

---

## 3.6 常见使用场景

### 场景 1: 建立聊天连接

```javascript
import { io } from 'socket.io-client';

// 1. 连接到 WebSocket
const socket = io('ws://localhost:3000/chat', {
  auth: { token: localStorage.getItem('jwt') },
});

// 2. 监听连接成功
socket.on('connection', (data) => {
  console.log('Connected as user:', data.userId);
});

// 3. 监听错误
socket.on('error', (error) => {
  console.error('Connection failed:', error.message);
  // 重定向到登录页
});
```

### 场景 2: 加入房间并发送消息

```javascript
// 1. 加入房间
socket.emit('joinRoom', { roomId: 'room-uuid' }, (response) => {
  if (response.success) {
    // 2. 发送消息
    socket.emit(
      'sendMessage',
      {
        roomId: 'room-uuid',
        content: 'Hello!',
        type: 'text',
      },
      (msgResponse) => {
        console.log('Message ID:', msgResponse.messageId);
      }
    );
  }
});

// 3. 监听其他用户的消息
socket.on('userJoined', (data) => {
  console.log(`${data.username} joined`);
});
```

### 场景 3: 实现输入指示器

```javascript
const messageInput = document.getElementById('message-input');
let typingTimeout;

messageInput.addEventListener('input', () => {
  // 发送开始输入
  socket.emit('typing', { roomId: 'room-uuid', isTyping: true });

  // 3秒后自动发送停止输入
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', { roomId: 'room-uuid', isTyping: false });
  }, 3000);
});

// 监听其他用户的输入状态
socket.on('userTyping', (data) => {
  updateTypingIndicator(data.username, data.isTyping);
});
```

### 场景 4: 分页加载历史消息

```javascript
let nextCursor = null;
let isLoading = false;

async function loadMessages(roomId, append = false) {
  if (isLoading) return;
  isLoading = true;

  const params = new URLSearchParams();
  if (nextCursor) {
    params.set('cursor', nextCursor);
  }
  params.set('limit', '20');
  params.set('order', 'DESC');

  const response = await fetch(`/api/v1/chat/rooms/${roomId}/messages?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await response.json();

  if (append) {
    appendMessages(data.data);
  } else {
    renderMessages(data.data);
  }

  nextCursor = data.nextCursor;
  isLoading = false;

  return data.hasMore;
}

// 滚动加载更多
messageList.addEventListener('scroll', async () => {
  if (messageList.scrollTop === 0 && nextCursor) {
    const hasMore = await loadMessages(currentRoomId, true);
    if (!hasMore) {
      showNoMoreMessages();
    }
  }
});
```

---

# 4. 消息队列与部署

## 4.1 消息队列架构

### 概述

聊天模块使用 **Bull** 队列处理异步任务，基于 Redis 实现持久化和可靠性保证。队列主要用于离线通知、日志追踪等非实时操作，实时消息通过 WebSocket 直接推送。

### 技术栈

| 组件     | 技术                | 用途             |
| -------- | ------------------- | ---------------- |
| 队列框架 | Bull (@nestjs/bull) | 任务队列管理     |
| 存储后端 | Redis (ioredis)     | 队列数据持久化   |
| 处理器   | MessageProcessor    | 任务处理逻辑     |
| 事件监听 | MessageEvents       | 队列生命周期回调 |

### Bull 队列配置

队列在 `QueueModule` 中全局注册，配置如下：

```typescript
// apps/backend/src/queue/queue.module.ts
@Global()
@Module({
  imports: [
    BullModule.forRoot({
      redis: getRedisUrl(), // 从 REDIS_URL 环境变量读取
      defaultJobOptions: {
        removeOnComplete: true, // 完成后自动删除
        removeOnFail: false, // 失败任务保留用于排查
        attempts: 3, // 最大重试次数
        backoff: {
          type: 'exponential', // 指数退避
          delay: 1000, // 初始延迟 1 秒
        },
      },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
```

**配置说明:**

| 配置项             | 值            | 说明                              |
| ------------------ | ------------- | --------------------------------- |
| `removeOnComplete` | `true`        | 成功任务自动清理，避免 Redis 膨胀 |
| `removeOnFail`     | `false`       | 失败任务保留，便于问题排查        |
| `attempts`         | `3`           | 最多重试 3 次                     |
| `backoff.type`     | `exponential` | 指数退避策略                      |
| `backoff.delay`    | `1000ms`      | 首次重试延迟 1 秒，后续翻倍       |

### 任务类型定义 (ChatJobData)

```typescript
// apps/backend/src/chat/chat.service.ts
interface ChatJobData {
  type: 'send_message' | 'edit_message' | 'recall_message' | 'mark_read';
  messageId?: string; // 消息 ID
  roomId?: string; // 房间 ID
  userId?: string; // 操作用户 ID
  content?: string; // 消息内容
  messageType?: MessageType; // 消息类型
  metadata?: Record<string, unknown>; // 元数据
  replyToId?: string; // 回复的消息 ID
  timestamp: number; // 任务创建时间戳
}
```

### 队列架构图

```mermaid
graph TB
    subgraph 客户端
        A[WebSocket Client]
        B[REST Client]
    end

    subgraph 应用层
        C[ChatGateway]
        D[ChatService]
        E[MessageQueue<br/>chat-message]
    end

    subgraph 队列处理
        F[MessageProcessor]
        G[MessageEvents]
    end

    subgraph 外部服务
        H[(Redis)]
        I[NotificationService]
        J[PresenceService]
        K[RoomService]
    end

    A -->|sendMessage| C
    B -->|PATCH /messages| D
    C --> D
    D -->|queue.add| E
    E -->|Redis| H
    H -->|consume| F
    F --> I
    F --> J
    F --> K
    F -.->|事件回调| G
```

---

## 4.2 任务处理流程

### 4.2.1 发送消息 (send_message)

最核心的任务，负责为离线用户创建推送通知。

```mermaid
sequenceDiagram
    participant Client as 客户端
    participant Gateway as ChatGateway
    participant Service as ChatService
    participant Queue as MessageQueue
    participant Processor as MessageProcessor
    participant Presence as PresenceService
    participant Room as RoomService
    participant Notify as NotificationService
    participant Redis as Redis

    Client->>Gateway: sendMessage(payload)
    Gateway->>Service: sendMessage(payload)

    Note over Service: 1. 验证成员身份
    Service->>Room: isMember(userId, roomId)
    Room-->>Service: true

    Note over Service: 2. 创建消息记录
    Service->>Service: messageService.create()

    Note over Service: 3. 加入队列
    Service->>Queue: add('send_message', data)
    Queue->>Redis: LPUSH

    Note over Service: 4. 更新房间活跃时间
    Service->>Room: updateLastMessageAt()

    Service-->>Gateway: { success, messageId }
    Gateway-->>Client: ack

    Note over Processor: 异步处理
    Redis->>Processor: BRPOP
    Processor->>Processor: handleSendMessage()

    Processor->>Room: getMembers(roomId)
    Room-->>Processor: [member1, member2, ...]

    Note over Processor: 排除发送者
    Processor->>Presence: getOnlineUsers(recipientIds)
    Presence-->>Processor: [{userId, isOnline}, ...]

    Note over Processor: 筛选离线用户
    loop 每个离线用户
        Processor->>Notify: create(notification)
    end

    Processor-->>Queue: complete
```

**处理代码:**

```typescript
// apps/backend/src/chat/queue/message.processor.ts
@Process('send_message')
async handleSendMessage(job: Job<ChatJobData>): Promise<void> {
  const { messageId, roomId, userId, content, messageType } = job.data;

  // 1. 获取房间所有成员
  const members = await this.roomService.getMembers(roomId);
  const memberIds = members.map((m) => m.userId);

  // 2. 排除发送者
  const recipientIds = memberIds.filter((id) => id !== userId);

  if (recipientIds.length === 0) return;

  // 3. 检查在线状态
  const onlineStatuses = await this.presenceService.getOnlineUsers(recipientIds);
  const onlineUserIds = new Set(
    onlineStatuses.filter((s) => s.isOnline).map((s) => s.userId)
  );

  // 4. 为离线用户创建通知
  const offlineUserIds = recipientIds.filter((id) => !onlineUserIds.has(id));

  if (offlineUserIds.length === 0) return;

  // 5. 批量创建通知
  const notificationPromises = offlineUserIds.map((recipientId) =>
    this.notificationService.create({
      userId: recipientId,
      type: NotificationType.MESSAGE,
      title: '新消息',
      content: this.truncateContent(content ?? ''),
      data: { messageId, roomId, senderId: userId, messageType },
    })
  );

  await Promise.all(notificationPromises);
}
```

### 4.2.2 编辑消息 (edit_message)

编辑消息的通知主要通过 WebSocket 实时推送，队列任务仅用于日志追踪。

```typescript
@Process('edit_message')
async handleEditMessage(job: Job<ChatJobData>): Promise<void> {
  const { messageId, roomId, userId } = job.data;

  this.logger.debug(
    `Processing edit_message: messageId=${messageId}, roomId=${roomId}, editorId=${userId}`
  );

  // 实时通知通过 WebSocket 推送
  // 此处仅记录日志便于追踪
}
```

### 4.2.3 撤回消息 (recall_message)

与编辑类似，实时通知通过 WebSocket 处理。

```typescript
@Process('recall_message')
async handleRecallMessage(job: Job<ChatJobData>): Promise<void> {
  const { messageId, roomId, userId } = job.data;

  this.logger.debug(
    `Processing recall_message: messageId=${messageId}, roomId=${roomId}, recallBy=${userId}`
  );

  // 实时通知通过 WebSocket 推送
}
```

### 4.2.4 标记已读 (mark_read)

```typescript
@Process('mark_read')
async handleMarkRead(job: Job<ChatJobData>): Promise<void> {
  const { roomId, userId } = job.data;

  this.logger.debug(`Processing mark_read: roomId=${roomId}, userId=${userId}`);

  // 实时通知通过 WebSocket 推送 (messagesRead 事件)
}
```

### 4.2.5 任务类型对比

| 任务类型         | 队列作用 | 实时推送       | 主要用途             |
| ---------------- | -------- | -------------- | -------------------- |
| `send_message`   | 离线通知 | WebSocket 广播 | 确保离线用户收到推送 |
| `edit_message`   | 日志追踪 | WebSocket 广播 | 追踪编辑操作         |
| `recall_message` | 日志追踪 | WebSocket 广播 | 追踪撤回操作         |
| `mark_read`      | 日志追踪 | WebSocket 广播 | 追踪已读状态         |

---

## 4.3 离线用户通知

### 通知机制

离线通知是消息队列的核心功能，确保用户即使不在线也能收到消息提醒。

### 通知数据结构

```typescript
// 创建的通知对象
{
  userId: string; // 接收者 ID
  type: NotificationType.MESSAGE; // 固定为 MESSAGE
  title: '新消息'; // 通知标题
  content: string; // 截断后的消息内容 (最大 100 字符)
  data: {
    messageId: string; // 消息 ID
    roomId: string; // 房间 ID
    senderId: string; // 发送者 ID
    messageType: MessageType; // 消息类型
  }
}
```

### 在线状态检测

在线状态通过 `PresenceService` 从 Redis 缓存中获取：

```typescript
// 在线状态缓存结构
interface PresenceData {
  status: 'online' | 'offline';
  lastActiveAt: string; // ISO 8601 时间戳
}

// 缓存配置
const PRESENCE_KEY = `presence:{userId}`;
const PRESENCE_TTL = 60; // 60 秒过期
```

### 内容截断

通知内容限制为 100 字符，超出部分显示省略号：

```typescript
private truncateContent(content: string, maxLength = 100): string {
  if (content.length <= maxLength) {
    return content;
  }
  return `${content.substring(0, maxLength)}...`;
}
```

### 通知流程图

```mermaid
flowchart TD
    A[消息入队] --> B[获取房间成员]
    B --> C[排除发送者]
    C --> D{有接收者?}
    D -->|否| E[结束]
    D -->|是| F[批量查询在线状态]
    F --> G{有离线用户?}
    G -->|否| H[跳过通知]
    G -->|是| I[批量创建通知]
    I --> J[完成]

    style A fill:#e1f5fe
    style I fill:#c8e6c9
    style E fill:#ffcdd2
```

---

## 4.4 队列事件监听

### MessageEvents 类

队列事件监听器负责监控任务生命周期，并提供 WebSocket 通知能力。

```typescript
// apps/backend/src/chat/queue/message.events.ts
@Injectable()
export class MessageEvents {
  private readonly logger = new Logger(MessageEvents.name);
  private websocketGateway: IWebsocketGateway | null = null;

  // 通过 setter 注入避免循环依赖
  setWebsocketGateway(gateway: IWebsocketGateway): void {
    this.websocketGateway = gateway;
  }
}
```

### 事件类型

| 装饰器                | 事件      | 触发时机     |
| --------------------- | --------- | ------------ |
| `@OnQueueActive()`    | active    | 任务开始处理 |
| `@OnQueueCompleted()` | completed | 任务处理成功 |
| `@OnQueueFailed()`    | failed    | 任务处理失败 |

### 事件载荷

```typescript
interface MessageEventPayload {
  event: QueueEventType; // 'active' | 'completed' | 'failed'
  jobType: ChatJobData['type']; // 任务类型
  messageId?: string;
  roomId?: string;
  userId?: string;
  timestamp: number;
  error?: string; // 仅 failed 事件
  jobId?: number | string;
  attemptsMade?: number; // 重试次数
}
```

### 失败处理

任务失败时的处理逻辑：

```typescript
@OnQueueFailed()
onFailed(job: Job<ChatJobData>, error: Error): void {
  this.logger.error(
    `Job failed: id=${job.id}, type=${job.data.type}, ` +
    `attemptsMade=${job.attemptsMade}, error=${error.message}`
  );

  // 达到最大重试次数时记录详细信息
  if (job.attemptsMade >= 3) {
    this.logger.error(
      `Job permanently failed after ${job.attemptsMade} attempts: ` +
      JSON.stringify({ type, messageId, roomId })
    );
  }

  // 通过 WebSocket 通知房间
  this.notifyRoomMembers(roomId, payload);
}
```

---

## 4.5 部署指南

### 4.5.1 环境变量

聊天模块依赖以下环境变量：

```bash
# ===========================================
# 数据库配置
# ===========================================

# PostgreSQL 连接字符串
# 本地开发: postgresql://postgres:postgres123@localhost:5432/app
# Neon (生产): postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
DATABASE_URL=postgresql://postgres:postgres123@localhost:5432/app

# 数据库 SSL (Neon 等云服务需要)
DB_SSL=true

# 数据库同步 (仅开发环境使用)
DB_SYNC=false

# ===========================================
# Redis 配置
# ===========================================

# Redis 连接字符串
# 本地: redis://localhost:6379
# 带密码: redis://:password@localhost:6379
# TLS: rediss://default:TOKEN@REGION.upstash.io:6379
REDIS_URL=redis://localhost:6379

# ===========================================
# 应用配置
# ===========================================

# 服务端口
PORT=3000

# 环境
NODE_ENV=production

# JWT 密钥
JWT_SECRET=your-super-secret-jwt-key

# ===========================================
# 前端 URL (CORS)
# ===========================================
FRONTEND_URL=https://portal.example.com
ADMIN_URL=https://admin.example.com
```

### 4.5.2 Redis 配置

#### 连接字符串格式

```
redis://[user:][password@]host[:port][/db]
rediss://[user:][password@]host[:port][/db]  (TLS)
```

#### 支持的 Redis 服务

| 服务        | 连接字符串示例                                          |
| ----------- | ------------------------------------------------------- |
| 本地 Redis  | `redis://localhost:6379`                                |
| 带密码      | `redis://:mypassword@localhost:6379`                    |
| 指定数据库  | `redis://localhost:6379/1`                              |
| Upstash     | `rediss://default:TOKEN@REGION.upstash.io:6379`         |
| Redis Cloud | `rediss://user:pass@redis-xxx.cloud.redislabs.com:6379` |

#### 连接重试策略

```typescript
// apps/backend/src/config/redis.config.ts
retryStrategy: (times: number) => {
  if (times > 3) {
    console.error('Redis connection failed after 3 retries');
    return null; // 停止重试
  }
  return Math.min(times * 200, 2000); // 最大 2 秒
},
maxRetriesPerRequest: 3,
```

### 4.5.3 数据库迁移

#### 生成迁移文件

```bash
# 在项目根目录执行
pnpm --filter @app-backend migration:generate -- -n AddChatTables
```

#### 执行迁移

```bash
# 生产环境
pnpm --filter @app-backend migration:run

# 回滚最后一次迁移
pnpm --filter @app-backend migration:revert
```

#### 迁移文件位置

```
apps/backend/
└── migrations/
    ├── 1700000000001-AddChatTables.ts
    └── 1700000000002-AddMessageIndexes.ts
```

### 4.5.4 Docker 部署

#### Docker Compose 示例

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/app
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    networks:
      - app-network

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres123
      - POSTGRES_DB=app
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    networks:
      - app-network

volumes:
  postgres-data:
  redis-data:

networks:
  app-network:
    driver: bridge
```

#### 后端 Dockerfile

```dockerfile
# apps/backend/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY apps/backend/package.json ./apps/backend/
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @app-backend build

FROM node:20-alpine AS runner

WORKDIR /app
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "dist/main.js"]
```

---

## 4.6 多实例部署

### 4.6.1 架构概述

多实例部署需要解决 WebSocket 连接同步问题。使用 Redis Adapter 实现 Socket.IO 跨实例通信。

```mermaid
graph TB
    subgraph 负载均衡层
        LB[Nginx / ALB]
    end

    subgraph 应用层
        B1[Backend Instance 1]
        B2[Backend Instance 2]
        B3[Backend Instance N]
    end

    subgraph 数据层
        R[(Redis<br/>Queue + Socket.IO Adapter)]
        P[(PostgreSQL)]
    end

    LB -->|Round Robin| B1
    LB -->|Round Robin| B2
    LB -->|Round Robin| B3

    B1 <-->|Pub/Sub| R
    B2 <-->|Pub/Sub| R
    B3 <-->|Pub/Sub| R

    B1 --> P
    B2 --> P
    B3 --> P
```

### 4.6.2 Redis Socket.IO Adapter

#### 配置方式

Redis Adapter 在 `main.ts` 中初始化：

```typescript
// apps/backend/src/main.ts
import { RedisIoAdapter } from './adapters/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 注册 Redis WebSocket 适配器
  const redisIoAdapter = new RedisIoAdapter(app);
  app.useWebSocketAdapter(redisIoAdapter);

  // ... 其他配置
}
```

#### Adapter 实现

```typescript
// apps/backend/src/adapters/redis-io.adapter.ts
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);

  createIOServer(port: number, options?: ServerOptions): any {
    const server = super.createIOServer(port, options);

    const redisUrl = getRedisUrl();
    const redisOptions = parseRedisUrl(redisUrl);

    // 创建 pub/sub 客户端
    const pubClient = new Redis(redisOptions);
    const subClient = pubClient.duplicate();

    // 连接事件处理
    pubClient.on('connect', () => this.logger.log('Redis pub client connected'));
    pubClient.on('error', (err) => this.logger.error('Redis pub client error:', err.message));
    subClient.on('connect', () => this.logger.log('Redis sub client connected'));
    subClient.on('error', (err) => this.logger.error('Redis sub client error:', err.message));

    // 设置 Redis 适配器
    const redisAdapter = createAdapter(pubClient, subClient);
    server.adapter(redisAdapter);

    this.logger.log('Redis Socket.IO adapter initialized');
    return server;
  }
}
```

### 4.6.3 负载均衡策略

#### Nginx 配置

```nginx
# /etc/nginx/conf.d/backend.conf
upstream backend {
    # WebSocket 需要使用 ip_hash 或 sticky sessions
    ip_hash;

    server backend-1:3000;
    server backend-2:3000;
    server backend-3:3000;
}

server {
    listen 80;
    server_name api.example.com;

    # WebSocket 升级支持
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # REST API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

#### 会话亲和性选项

| 策略            | 说明         | 适用场景                 |
| --------------- | ------------ | ------------------------ |
| `ip_hash`       | 基于 IP 哈希 | 简单部署，WebSocket 可用 |
| `sticky cookie` | 基于 Cookie  | 需要更均匀的分布         |
| `least_conn`    | 最少连接     | REST API 负载均衡        |

### 4.6.4 水平扩展注意事项

#### 队列处理

Bull 队列天然支持多实例，Redis 作为协调器确保任务不会被重复处理：

```mermaid
sequenceDiagram
    participant B1 as Backend 1
    participant B2 as Backend 2
    participant R as Redis
    participant Q as Queue

    B1->>R: BRPOP queue (blocking)
    B2->>R: BRPOP queue (blocking)
    Note over R: 任务入队
    Q->>R: LPUSH task1
    R-->>B1: task1 (只有一个消费者获取)
    Note over B2: 继续等待
```

#### 在线状态同步

多实例环境下，在线状态存储在 Redis 中共享：

```typescript
// PresenceService 使用共享的 Redis 缓存
const PRESENCE_KEY = `presence:${userId}`;
const PRESENCE_TTL = 60; // 60 秒

// 所有实例访问同一个 Redis，状态一致
```

#### WebSocket 广播

通过 Redis Adapter，任何实例的广播都能到达所有连接的客户端：

```mermaid
sequenceDiagram
    participant C1 as Client 1<br/>(连接到 Instance 1)
    participant C2 as Client 2<br/>(连接到 Instance 2)
    participant I1 as Instance 1
    participant I2 as Instance 2
    participant R as Redis

    C1->>I1: sendMessage
    I1->>I1: 处理消息
    I1->>R: PUBLISH chat:message
    R-->>I1: (本实例直接发送)
    R-->>I2: (广播到其他实例)
    I1-->>C1: newMessage
    I2-->>C2: newMessage
```

---

## 4.7 运维指南

### 4.7.1 健康检查

#### 应用健康端点

```bash
# Kubernetes liveness/readiness probe
curl http://localhost:3000/api/health
```

#### Redis 连接检查

```typescript
// 检查 Redis 连接状态
const redis = new Redis(process.env.REDIS_URL);
redis.ping().then(() => console.log('Redis OK'));
```

### 4.7.2 监控指标

#### 关键指标

| 指标             | 说明                   | 告警阈值     |
| ---------------- | ---------------------- | ------------ |
| 队列积压         | 等待处理的任务数       | > 100        |
| 任务失败率       | 失败任务占比           | > 5%         |
| Redis 内存       | 内存使用量             | > 80%        |
| WebSocket 连接数 | 活跃连接数             | 根据容量规划 |
| 消息延迟         | 消息从发送到接收的时间 | > 500ms      |

#### Bull Board (可选)

使用 Bull Board 监控队列状态：

```typescript
// 安装
// pnpm add @bull-board/express @bull-board/api

import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [new BullAdapter(messageQueue)],
  serverAdapter,
});

serverAdapter.setBasePath('/admin/queues');
app.use('/admin/queues', serverAdapter.getRouter());
```

### 4.7.3 日志配置

#### 日志级别

```bash
# 环境变量
LOG_LEVEL=info  # debug, info, warn, error
```

#### 关键日志点

| 事件           | 日志级别 | 示例                                  |
| -------------- | -------- | ------------------------------------- |
| 任务开始处理   | debug    | `Job active: id=1, type=send_message` |
| 任务完成       | debug    | `Job completed: id=1, attemptsMade=1` |
| 任务失败       | error    | `Job failed: id=1, error=...`         |
| Redis 连接     | log      | `Redis pub client connected`          |
| WebSocket 连接 | debug    | `Client connected: socketId=xxx`      |

### 4.7.4 故障排查

#### 常见问题

**1. 消息队列不处理任务**

```bash
# 检查 Redis 连接
redis-cli ping

# 检查队列状态
redis-cli LLEN bull:chat-message:wait

# 查看失败任务
redis-cli KEYS "bull:chat-message:failed*"
```

**2. WebSocket 消息不同步**

```bash
# 检查 Redis Adapter 连接
# 查看日志中是否有 "Redis Socket.IO adapter initialized"

# 检查 pub/sub 客户端状态
redis-cli PUBSUB CHANNELS
```

**3. 离线通知未发送**

```bash
# 检查在线状态缓存
redis-cli GET "presence:{userId}"

# 检查通知表
psql -c "SELECT * FROM notifications WHERE user_id = 'xxx' ORDER BY created_at DESC LIMIT 10;"
```

#### 调试命令

```bash
# 查看队列任务数量
redis-cli LLEN bull:chat-message:wait

# 清空队列 (谨慎使用)
redis-cli DEL bull:chat-message:wait

# 重试失败任务
redis-cli RPOPLPUSH bull:chat-message:failed bull:chat-message:wait

# 监控 Redis 命令
redis-cli MONITOR
```

---

## 4.8 配置速查表

### 环境变量

| 变量           | 必需 | 默认值                   | 说明                  |
| -------------- | ---- | ------------------------ | --------------------- |
| `DATABASE_URL` | 是   | -                        | PostgreSQL 连接字符串 |
| `REDIS_URL`    | 是   | `redis://localhost:6379` | Redis 连接字符串      |
| `JWT_SECRET`   | 是   | -                        | JWT 签名密钥          |
| `PORT`         | 否   | `3000`                   | 服务端口              |
| `NODE_ENV`     | 否   | `development`            | 运行环境              |
| `DB_SSL`       | 否   | `false`                  | 数据库 SSL            |
| `FRONTEND_URL` | 否   | -                        | 前端 URL (CORS)       |
| `ADMIN_URL`    | 否   | -                        | 管理后台 URL          |

### 队列配置

| 配置     | 值             | 说明             |
| -------- | -------------- | ---------------- |
| 队列名称 | `chat-message` | Bull 队列标识    |
| 最大重试 | `3`            | 失败后重试次数   |
| 退避策略 | `exponential`  | 重试间隔递增     |
| 初始延迟 | `1000ms`       | 首次重试延迟     |
| 完成清理 | `true`         | 成功任务自动删除 |
| 失败保留 | `false`        | 失败任务保留     |

### Redis 配置

| 配置         | 值           | 说明             |
| ------------ | ------------ | ---------------- |
| 最大重试     | `3`          | 连接失败重试     |
| 重试间隔     | `200-2000ms` | 指数退避         |
| 在线状态 TTL | `60s`        | 在线状态缓存过期 |

---

## 4.9 部署检查清单

### 部署前

- [ ] 配置 `DATABASE_URL` 环境变量
- [ ] 配置 `REDIS_URL` 环境变量
- [ ] 配置 `JWT_SECRET` (生产环境必须更换)
- [ ] 运行数据库迁移 `migration:run`
- [ ] 检查 Redis 连接
- [ ] 配置 CORS 允许的域名

### 部署后

- [ ] 验证健康检查端点
- [ ] 测试 WebSocket 连接
- [ ] 测试消息发送和接收
- [ ] 检查队列处理日志
- [ ] 配置监控告警

### 多实例部署

- [ ] 配置 Redis Socket.IO Adapter
- [ ] 配置负载均衡 (Nginx/ALB)
- [ ] 测试跨实例 WebSocket 广播
- [ ] 验证队列任务不重复处理
- [ ] 验证在线状态共享

---

**文档生成时间:** 2026-03-14
