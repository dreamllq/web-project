/**
 * Chat Room Real-time Event Types
 * Used for WebSocket/SSE communication between backend and frontend
 */

// Event type constants
export type ChatEventType =
  | 'room:created'
  | 'room:updated'
  | 'room:deleted'
  | 'member:added'
  | 'member:removed'
  | 'unread:updated';

// Base event interface
export interface BaseChatEvent {
  readonly type: ChatEventType;
  readonly roomId: string;
  readonly timestamp: number;
}

// Room created event data
export interface RoomCreatedData {
  name: string;
  type: 'private' | 'group';
  members: Array<{
    userId: string;
    username: string;
    avatar?: string;
  }>;
}

export interface RoomCreatedEvent extends BaseChatEvent {
  readonly type: 'room:created';
  readonly data: RoomCreatedData;
}

// Room updated event data
export interface RoomUpdatedData {
  name?: string;
  isHidden?: boolean;
  lastMessage?: {
    content: string;
    senderId: string;
    senderName: string;
    createdAt: number;
  };
}

export interface RoomUpdatedEvent extends BaseChatEvent {
  readonly type: 'room:updated';
  readonly data: RoomUpdatedData;
}

// Room deleted event data (empty - roomId is enough)
export type RoomDeletedData = Record<string, never>;

export interface RoomDeletedEvent extends BaseChatEvent {
  readonly type: 'room:deleted';
  readonly data: RoomDeletedData;
}

// Member added event data
export interface MemberAddedData {
  userId: string;
  username: string;
  avatar?: string;
}

export interface MemberAddedEvent extends BaseChatEvent {
  readonly type: 'member:added';
  readonly data: MemberAddedData;
}

// Member removed event data
export interface MemberRemovedData {
  userId: string;
  reason?: string;
}

export interface MemberRemovedEvent extends BaseChatEvent {
  readonly type: 'member:removed';
  readonly data: MemberRemovedData;
}

// Unread count updated event data
export interface UnreadUpdatedData {
  unreadCount: number;
}

export interface UnreadUpdatedEvent extends BaseChatEvent {
  readonly type: 'unread:updated';
  readonly data: UnreadUpdatedData;
}

// Union type for all chat events
export type ChatEvent =
  | RoomCreatedEvent
  | RoomUpdatedEvent
  | RoomDeletedEvent
  | MemberAddedEvent
  | MemberRemovedEvent
  | UnreadUpdatedEvent;
