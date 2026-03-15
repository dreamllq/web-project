// ============================================
// Enum Types (as union types for type safety)
// ============================================

/**
 * 房间类型
 * - private: 私聊 - 仅两人
 * - group: 群聊 - 多人
 * - broadcast: 广播 - 单向消息
 */
export type RoomType = 'private' | 'group' | 'broadcast';

/**
 * 消息类型
 * - text: 文本消息
 * - image: 图片消息
 * - file: 文件消息
 * - emoji: 表情消息
 * - system: 系统消息
 */
export type MessageType = 'text' | 'image' | 'file' | 'emoji' | 'system';

/**
 * 成员角色
 * - owner: 房主 - 群聊创建者
 * - admin: 管理员 - 可管理成员
 * - member: 普通成员
 */
export type MemberRole = 'owner' | 'admin' | 'member';

// ============================================
// Entity Types
// ============================================

/**
 * 聊天房间实体
 */
export interface Room {
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
  lastMessageAt: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 房间成员实体
 */
export interface RoomMember {
  /** 成员记录 ID */
  id: string;
  /** 房间 ID */
  roomId: string;
  /** 用户 ID */
  userId: string;
  /** 角色 */
  role: MemberRole;
  /** 加入时间 */
  joinedAt: string;
  /** 最后已读时间 */
  lastReadAt: string;
}

/**
 * 消息实体
 */
export interface Message {
  /** 消息 ID */
  id: string;
  /** 所属房间 ID */
  roomId: string;
  /** 发送者 ID */
  senderId: string;
  /** 消息类型 */
  type: MessageType;
  /** 消息内容 (撤回后为 null) */
  content: string | null;
  /** 附加元数据 */
  metadata: Record<string, unknown> | null;
  /** 回复的消息 ID */
  replyToId: string | null;
  /** 编辑时间 (未编辑为 null) */
  editedAt: string | null;
  /** 撤回时间 (未撤回为 null) */
  deletedAt: string | null;
  /** 创建时间 */
  createdAt: string;
}

// ============================================
// Request DTOs
// ============================================

/**
 * 创建房间请求 DTO
 */
export interface CreateRoomDto {
  /** 房间类型: private | group | broadcast */
  type: RoomType;
  /** 房间名称 (群聊必填)，1-100 字符 */
  name?: string;
  /** 头像 URL，最大 500 字符 */
  avatar?: string;
  /** 初始成员 ID 数组 */
  memberIds?: string[];
}

/**
 * 添加成员请求 DTO
 */
export interface AddMemberDto {
  /** 要添加的用户 ID (UUID v4) */
  userId: string;
}

/**
 * 编辑消息请求 DTO
 */
export interface EditMessageDto {
  /** 新消息内容，1-10000 字符 */
  content: string;
}

/**
 * 消息查询参数 DTO
 */
export interface MessageQueryDto {
  /** 分页游标 (消息 ID) */
  cursor?: string;
  /** 每页数量，1-100，默认 20 */
  limit?: number;
  /** 排序方向，ASC | DESC，默认 DESC */
  order?: 'ASC' | 'DESC';
}

// ============================================
// WebSocket Payload Types
// ============================================

/**
 * 发送消息 WebSocket Payload
 */
export interface SendMessagePayload {
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

/**
 * 编辑消息 WebSocket Payload
 */
export interface EditMessagePayload {
  /** 要编辑的消息 ID */
  messageId: string;
  /** 新消息内容 */
  content: string;
}

/**
 * 输入状态 WebSocket Payload
 */
export interface TypingPayload {
  /** 房间 ID */
  roomId: string;
  /** 是否正在输入 */
  isTyping: boolean;
}

/**
 * 标记已读 WebSocket Payload
 */
export interface MarkReadPayload {
  /** 房间 ID */
  roomId: string;
}

// ============================================
// Response Types
// ============================================

/**
 * 房间响应类型
 */
export interface RoomResponse {
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
  lastMessageAt: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 用户房间响应类型 (包含用户在该房间的信息)
 */
export interface UserRoomResponse {
  /** 房间信息 */
  room: RoomResponse;
  /** 用户在房间中的角色 */
  role: MemberRole;
  /** 未读消息数 */
  unreadCount: number;
  /** 最后已读时间 */
  lastReadAt: string;
}

/**
 * 房间列表响应类型
 */
export interface RoomListResponse {
  /** 房间列表 */
  data: UserRoomResponse[];
}

/**
 * 消息响应类型
 */
export interface MessageResponse {
  /** 消息 ID */
  id: string;
  /** 所属房间 ID */
  roomId: string;
  /** 发送者 ID */
  senderId: string;
  /** 发送者名称 */
  senderName?: string;
  /** 消息类型 */
  type: MessageType;
  /** 消息内容 (撤回后为 null) */
  content: string | null;
  /** 附加元数据 */
  metadata: Record<string, unknown> | null;
  /** 回复的消息 ID */
  replyToId: string | null;
  /** 编辑时间 (未编辑为 null) */
  editedAt: string | null;
  /** 撤回时间 (未撤回为 null) */
  deletedAt: string | null;
  /** 创建时间 */
  createdAt: string;
}

/**
 * 消息列表响应类型 (游标分页)
 */
export interface MessageListResponse {
  /** 消息列表 */
  data: MessageResponse[];
  /** 下一页游标 (无更多数据时为 null) */
  nextCursor: string | null;
  /** 是否还有更多消息 */
  hasMore: boolean;
}

/**
 * 成员响应类型
 */
export interface MemberResponse {
  /** 成员记录 ID */
  id: string;
  /** 房间 ID */
  roomId: string;
  /** 用户 ID */
  userId: string;
  /** 角色 */
  role: MemberRole;
  /** 加入时间 */
  joinedAt: string;
  /** 最后已读时间 */
  lastReadAt: string;
}
