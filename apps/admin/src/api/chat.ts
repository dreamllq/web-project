import api from './index';

// ============================================
// Types (inline until @/types/chat.ts is created)
// ============================================

export type RoomType = 'private' | 'group' | 'broadcast';
export type MessageType = 'text' | 'image' | 'file' | 'emoji' | 'system';
export type RoomMemberRole = 'owner' | 'admin' | 'member';

export interface CreateRoomDto {
  type: RoomType;
  name?: string;
  avatar?: string;
  memberIds?: string[];
}

export interface Room {
  id: string;
  type: RoomType;
  name: string | null;
  avatar: string | null;
  ownerId: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomWithMembership {
  room: Room;
  role: RoomMemberRole;
  unreadCount: number;
  lastReadAt: string;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  type: MessageType;
  content: string;
  metadata: Record<string, unknown> | null;
  replyToId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface MessageQuery {
  cursor?: string;
  limit?: number;
  order?: 'ASC' | 'DESC';
}

export interface MessagesResponse {
  data: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AddMemberDto {
  userId: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
  lastReadAt: string;
}

export interface MemberWithUserResponse {
  id: string;
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
  lastReadAt: string;
  user?: {
    id: string;
    username: string;
    nickname: string | null;
    avatarUrl: string | null;
  };
}

export interface EditMessageDto {
  content: string;
}

// ============================================
// Room Management API Functions
// ============================================

/**
 * Create a new chat room
 * POST /v1/chat/rooms
 */
export function createRoom(data: CreateRoomDto): Promise<{ data: Room }> {
  return api.post('/v1/chat/rooms', data);
}

/**
 * Get all rooms for current user
 * GET /v1/chat/rooms
 */
export function getRooms(): Promise<{ data: { data: RoomWithMembership[] } }> {
  return api.get('/v1/chat/rooms');
}

/**
 * Get room messages with cursor pagination
 * GET /v1/chat/rooms/:id/messages
 */
export function getRoomMessages(
  roomId: string,
  query?: MessageQuery
): Promise<{ data: MessagesResponse }> {
  return api.get(`/v1/chat/rooms/${roomId}/messages`, { params: query });
}

/**
 * Add a member to a room
 * POST /v1/chat/rooms/:id/members
 */
export function addRoomMember(roomId: string, data: AddMemberDto): Promise<{ data: RoomMember }> {
  return api.post(`/v1/chat/rooms/${roomId}/members`, data);
}

/**
 * Leave a room (remove self from room)
 * DELETE /v1/chat/rooms/:id/members/me
 * Note: Private rooms will return 403 Forbidden
 */
export function leaveRoom(roomId: string): Promise<{ data: { success: boolean } }> {
  return api.delete(`/v1/chat/rooms/${roomId}/members/me`);
}

/**
 * Update current user's member settings for a room
 * PATCH /v1/chat/rooms/:id/members/me
 * Used to hide/show private rooms without leaving them
 */
export interface UpdateMemberSettingsDto {
  isHidden?: boolean;
}

export interface MemberSettingsResponse {
  id: string;
  roomId: string;
  userId: string;
  role: RoomMemberRole;
  joinedAt: string;
  lastReadAt: string;
  isHidden: boolean;
}

export function updateMemberSettings(
  roomId: string,
  data: UpdateMemberSettingsDto
): Promise<{ data: MemberSettingsResponse }> {
  return api.patch(`/v1/chat/rooms/${roomId}/members/me`, data);
}

/**
 * Get members of a room
 * GET /v1/chat/rooms/:id/members
 */
export function getRoomMembers(
  roomId: string
): Promise<{ data: { data: MemberWithUserResponse[] } }> {
  return api.get(`/v1/chat/rooms/${roomId}/members`);
}

/**
 * Remove a member from a room (admin/owner only)
 * DELETE /v1/chat/rooms/:id/members/:userId
 */
export function removeRoomMember(
  roomId: string,
  userId: string
): Promise<{ data: { success: boolean } }> {
  return api.delete(`/v1/chat/rooms/${roomId}/members/${userId}`);
}

// ============================================
// Message Management API Functions
// ============================================

/**
 * Edit a message
 * PATCH /v1/chat/messages/:id
 */
export function editMessage(messageId: string, data: EditMessageDto): Promise<{ data: Message }> {
  return api.patch(`/v1/chat/messages/${messageId}`, data);
}

/**
 * Delete (recall) a message
 * DELETE /v1/chat/messages/:id
 */
export function deleteMessage(messageId: string): Promise<{ data: Message }> {
  return api.delete(`/v1/chat/messages/${messageId}`);
}

// ============================================
// File Upload API Functions
// ============================================

export interface FileUploadResponse {
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/**
 * Upload a file to chat room
 * POST /v1/chat/upload
 */
export function uploadFile(file: File, roomId: string): Promise<{ data: FileUploadResponse }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('roomId', roomId);
  return api.post('/v1/chat/upload', formData);
}
