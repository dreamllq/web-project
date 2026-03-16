/**
 * Chat Store - Pinia store for chat state management
 *
 * Manages chat rooms, messages, online users, typing indicators, and unread counts.
 * Integrates with WebSocket module for real-time updates.
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Socket } from 'socket.io-client';
import { ElMessage } from 'element-plus';
import {
  connect,
  disconnect,
  getSocket,
  isConnected,
  setOnReconnect,
  setOnTokenRefresh,
} from '@/socket';
import {
  getRooms,
  getRoomMessages,
  leaveRoom as leaveRoomApi,
  getRoomMembers as getRoomMembersApi,
  removeRoomMember as removeRoomMemberApi,
} from '@/api/chat';
import { refreshAccessToken, extractApiError } from '@/api';
import { useAuthStore } from '@/stores/auth';
import type {
  SendMessagePayload,
  EditMessagePayload,
  TypingPayload,
  UserRoomResponse,
  MessageResponse,
} from '@/types/chat';

// ============================================
// WebSocket Event Payload Types (Server → Client)
// ============================================

interface NewMessageEvent {
  id: string;
  roomId: string;
  senderId: string;
  senderName?: string;
  type: string;
  content: string;
  metadata: Record<string, unknown> | null;
  replyToId: string | null;
  createdAt: string;
}

interface MessageEditedEvent {
  messageId: string;
  roomId: string;
  editorId: string;
  content: string;
  editedAt: string;
}

interface MessageRecalledEvent {
  messageId: string;
  roomId: string;
  recalledAt: string;
}

interface UserJoinedEvent {
  userId: string;
  username: string;
  roomId: string;
  timestamp: string;
}

interface UserLeftEvent {
  userId: string;
  username: string;
  roomId: string;
  timestamp: string;
}

interface UserTypingEvent {
  userId: string;
  username: string;
  roomId: string;
  isTyping: boolean;
  timestamp: string;
}

interface MessagesReadEvent {
  userId: string;
  username: string;
  roomId: string;
  readAt: string;
}

interface RoomDeletedEvent {
  roomId: string;
  deletedBy: string;
  deletedAt: string;
}

// ============================================
// Message Queue Types
// ============================================

/** Message status for tracking send state */
export type MessageStatus = 'pending' | 'sending' | 'sent' | 'failed';

/** Queued message with tracking info */
export interface QueuedMessage {
  /** Temporary client-side ID */
  tempId: string;
  /** Original payload */
  payload: SendMessagePayload;
  /** Current status */
  status: MessageStatus;
  /** Error message if failed */
  error: string | null;
  /** Timestamp when queued */
  queuedAt: number;
}

// ============================================
// Store Definition
// ============================================

export const useChatStore = defineStore('chat', () => {
  // ============================================
  // State
  // ============================================

  /** All rooms with membership info */
  const rooms = ref<UserRoomResponse[]>([]);

  /** Hidden room IDs (for private rooms that user wants to hide locally) - persisted in localStorage */
  const HIDDEN_ROOMS_KEY = 'chat_hidden_room_ids';

  function loadHiddenRoomIds(): Set<string> {
    try {
      const stored = localStorage.getItem(HIDDEN_ROOMS_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }

  const hiddenRoomIds = ref<Set<string>>(loadHiddenRoomIds());

  /** Save hiddenRoomIds to localStorage */
  function saveHiddenRoomIds(): void {
    try {
      localStorage.setItem(HIDDEN_ROOMS_KEY, JSON.stringify([...hiddenRoomIds.value]));
    } catch {
      // Ignore localStorage errors
    }
  }

  /** Current active room ID */
  const currentRoomId = ref<string | null>(null);

  /** Messages grouped by room ID */
  const messagesByRoom = ref<Map<string, MessageResponse[]>>(new Map());

  /** Online users grouped by room ID (Set of user IDs) */
  const onlineUsersByRoom = ref<Map<string, Set<string>>>(new Map());

  /** Typing users grouped by room ID (Map of userId → username) */
  const typingUsersByRoom = ref<Map<string, Map<string, string>>>(new Map());

  /** Unread counts grouped by room ID */
  const unreadCounts = ref<Map<string, number>>(new Map());

  /** Loading states */
  const isLoadingRooms = ref(false);
  const isLoadingMessages = ref(false);

  /** Pagination state for infinite scroll */
  const hasMoreByRoom = ref<Map<string, boolean>>(new Map());
  const nextCursorByRoom = ref<Map<string, string | null>>(new Map());
  const isLoadingMore = ref(false);

  /** Error state */
  const error = ref<string | null>(null);

  /** Socket connection state */
  const isSocketConnected = ref(false);

  /** Registered event handlers for cleanup */
  let registeredEventHandlers = false;

  // ============================================
  // Message Queue State (Edge Case Handling)
  // ============================================

  /** Pending messages waiting to be sent (when offline) */
  const pendingMessages = ref<Map<string, QueuedMessage>>(new Map());

  /** Failed messages with error info */
  const failedMessages = ref<Map<string, QueuedMessage>>(new Map());

  /** Message status map (tempId -> status) for UI tracking */
  const messageStatus = ref<Map<string, MessageStatus>>(new Map());

  // ============================================
  // Computed
  // ============================================

  /** Current room info */
  const currentRoom = computed<UserRoomResponse | null>(() => {
    if (!currentRoomId.value) return null;
    return rooms.value.find((r) => r.room.id === currentRoomId.value) ?? null;
  });

  /** Messages for current room */
  const currentMessages = computed<MessageResponse[]>(() => {
    if (!currentRoomId.value) return [];
    return messagesByRoom.value.get(currentRoomId.value) ?? [];
  });

  /** Typing users for current room */
  const currentTypingUsers = computed<Map<string, string>>(() => {
    if (!currentRoomId.value) return new Map();
    return typingUsersByRoom.value.get(currentRoomId.value) ?? new Map();
  });

  /** Online users for current room */
  const currentOnlineUsers = computed<Set<string>>(() => {
    if (!currentRoomId.value) return new Set();
    return onlineUsersByRoom.value.get(currentRoomId.value) ?? new Set();
  });

  /** Total unread count across all rooms */
  const totalUnreadCount = computed(() => {
    let total = 0;
    unreadCounts.value.forEach((count) => {
      total += count;
    });
    return total;
  });

  /** Visible rooms (excludes hidden private rooms) */
  const visibleRooms = computed<UserRoomResponse[]>(() => {
    const hidden = hiddenRoomIds.value;
    return rooms.value.filter((r) => !hidden.has(r.room.id));
  });

  // ============================================
  // Helper Functions
  // ============================================

  /**
   * Initialize data structures for a room
   */
  function initRoomData(roomId: string): void {
    if (!messagesByRoom.value.has(roomId)) {
      messagesByRoom.value.set(roomId, []);
    }
    if (!onlineUsersByRoom.value.has(roomId)) {
      onlineUsersByRoom.value.set(roomId, new Set());
    }
    if (!typingUsersByRoom.value.has(roomId)) {
      typingUsersByRoom.value.set(roomId, new Map());
    }
  }

  /**
   * Update unread count for a room
   */
  function updateUnreadCount(roomId: string, count: number): void {
    unreadCounts.value.set(roomId, Math.max(0, count));
    // Trigger reactivity
    unreadCounts.value = new Map(unreadCounts.value);
  }

  /**
   * Request browser notification permission
   * @returns Promise that resolves to true if permission is granted
   */
  async function requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('[Chat] Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('[Chat] Notification permission denied');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  /**
   * Show browser notification for new message
   */
  function showMessageNotification(roomName: string, content: string): void {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return;

    // Truncate content if too long
    const truncatedContent = content.length > 100 ? content.slice(0, 100) + '...' : content;

    new Notification(roomName, {
      body: truncatedContent,
      icon: '/favicon.ico',
      tag: 'chat-message',
    });
  }

  // ============================================
  // Socket Event Handlers
  // ============================================

  function handleNewMessage(data: NewMessageEvent): void {
    console.log('[Chat] Received newMessage event:', data);
    const message: MessageResponse = {
      id: data.id,
      roomId: data.roomId,
      senderId: data.senderId,
      senderName: data.senderName,
      type: data.type as MessageResponse['type'],
      content: data.content,
      metadata: data.metadata,
      replyToId: data.replyToId,
      editedAt: null,
      deletedAt: null,
      createdAt: data.createdAt,
    };

    initRoomData(data.roomId);
    const roomMessages = messagesByRoom.value.get(data.roomId);
    if (roomMessages) {
      // Check if this is our own message (optimistic update already added it)
      const authStore = useAuthStore();
      const currentUserId = authStore.user?.id;
      const existingIndex = roomMessages.findIndex(
        (m) =>
          m.senderId === currentUserId &&
          m.senderId === data.senderId &&
          m.content === data.content &&
          m.id.startsWith('temp_')
      );

      if (existingIndex !== -1) {
        // Replace temporary message with confirmed message
        roomMessages[existingIndex] = message;
      } else {
        // New message from others, add to list
        // Use unshift: 消息存储为 DESC 顺序（最新在前），新消息应插入数组头部
        roomMessages.unshift(message);
      }
      messagesByRoom.value.set(data.roomId, [...roomMessages]);
    }

    // Update unread count if not in current room
    if (currentRoomId.value !== data.roomId) {
      const currentCount = unreadCounts.value.get(data.roomId) ?? 0;
      updateUnreadCount(data.roomId, currentCount + 1);

      // Show browser notification when window is not focused
      if (data.content) {
        const roomInfo = rooms.value.find((r) => r.room.id === data.roomId);
        const roomName = roomInfo?.room.name ?? 'Chat';
        showMessageNotification(roomName, data.content);
      }
    }
  }

  function handleMessageEdited(data: MessageEditedEvent): void {
    const roomMessages = messagesByRoom.value.get(data.roomId);
    if (roomMessages) {
      const index = roomMessages.findIndex((m) => m.id === data.messageId);
      if (index !== -1) {
        roomMessages[index] = {
          ...roomMessages[index],
          content: data.content,
          editedAt: data.editedAt,
        };
        messagesByRoom.value.set(data.roomId, [...roomMessages]);
      }
    }
  }

  function handleMessageRecalled(data: MessageRecalledEvent): void {
    const roomMessages = messagesByRoom.value.get(data.roomId);
    if (roomMessages) {
      const index = roomMessages.findIndex((m) => m.id === data.messageId);
      if (index !== -1) {
        roomMessages[index] = {
          ...roomMessages[index],
          content: null,
          deletedAt: data.recalledAt,
        };
        messagesByRoom.value.set(data.roomId, [...roomMessages]);
      }
    }
  }

  function handleUserJoined(data: UserJoinedEvent): void {
    initRoomData(data.roomId);
    const onlineUsers = onlineUsersByRoom.value.get(data.roomId);
    if (onlineUsers) {
      onlineUsers.add(data.userId);
      onlineUsersByRoom.value.set(data.roomId, new Set(onlineUsers));
    }
  }

  function handleUserLeft(data: UserLeftEvent): void {
    const onlineUsers = onlineUsersByRoom.value.get(data.roomId);
    if (onlineUsers) {
      onlineUsers.delete(data.userId);
      onlineUsersByRoom.value.set(data.roomId, new Set(onlineUsers));
    }

    // Remove from typing users
    const typingUsers = typingUsersByRoom.value.get(data.roomId);
    if (typingUsers) {
      typingUsers.delete(data.userId);
      typingUsersByRoom.value.set(data.roomId, new Map(typingUsers));
    }
  }

  function handleUserTyping(data: UserTypingEvent): void {
    initRoomData(data.roomId);
    const typingUsers = typingUsersByRoom.value.get(data.roomId);
    if (typingUsers) {
      if (data.isTyping) {
        typingUsers.set(data.userId, data.username);
      } else {
        typingUsers.delete(data.userId);
      }
      typingUsersByRoom.value.set(data.roomId, new Map(typingUsers));
    }
  }

  function handleMessagesRead(data: MessagesReadEvent): void {
    // Could be used to update read receipts UI
    console.log('[Chat] Messages read:', data);
  }

  /**
   * Handle room deleted event - remove from rooms list and cleanup
   */
  function handleRoomDeleted(data: RoomDeletedEvent): void {
    const { roomId } = data;

    // Remove room from rooms list
    const roomIndex = rooms.value.findIndex((r) => r.room.id === roomId);
    if (roomIndex !== -1) {
      const deletedRoom = rooms.value[roomIndex];
      rooms.value.splice(roomIndex, 1);

      // Show notification
      ElMessage.warning(`聊天室 "${deletedRoom.room.name ?? '私聊'}" 已被删除`);
    }

    // Clear current room if it's the deleted one
    if (currentRoomId.value === roomId) {
      currentRoomId.value = null;
    }

    // Cleanup room data
    messagesByRoom.value.delete(roomId);
    onlineUsersByRoom.value.delete(roomId);
    typingUsersByRoom.value.delete(roomId);
    unreadCounts.value.delete(roomId);
    pendingMessages.value.delete(roomId);
    failedMessages.value.delete(roomId);

    // Trigger reactivity
    messagesByRoom.value = new Map(messagesByRoom.value);
    onlineUsersByRoom.value = new Map(onlineUsersByRoom.value);
    typingUsersByRoom.value = new Map(typingUsersByRoom.value);
    unreadCounts.value = new Map(unreadCounts.value);
    pendingMessages.value = new Map(pendingMessages.value);
    failedMessages.value = new Map(failedMessages.value);
  }

  /**
   * Register all socket event listeners
   */
  function registerSocketEvents(socket: Socket): void {
    if (registeredEventHandlers) return;

    socket.on('newMessage', handleNewMessage);
    socket.on('messageEdited', handleMessageEdited);
    socket.on('messageRecalled', handleMessageRecalled);
    socket.on('userJoined', handleUserJoined);
    socket.on('userLeft', handleUserLeft);
    socket.on('userTyping', handleUserTyping);
    socket.on('messagesRead', handleMessagesRead);
    socket.on('roomDeleted', handleRoomDeleted);

    registeredEventHandlers = true;
  }

  /**
   * Unregister all socket event listeners
   */
  function unregisterSocketEvents(socket: Socket): void {
    socket.off('newMessage', handleNewMessage);
    socket.off('messageEdited', handleMessageEdited);
    socket.off('messageRecalled', handleMessageRecalled);
    socket.off('userJoined', handleUserJoined);
    socket.off('userLeft', handleUserLeft);
    socket.off('userTyping', handleUserTyping);
    socket.off('messagesRead', handleMessagesRead);
    socket.off('roomDeleted', handleRoomDeleted);

    registeredEventHandlers = false;
  }

  // ============================================
  // Message Queue Helpers
  // ============================================

  /**
   * Generate a temporary ID for queued messages
   */
  function generateTempId(): string {
    return `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Process pending messages queue (called on reconnect)
   */
  function processPendingMessages(): void {
    if (pendingMessages.value.size === 0) return;

    console.log(`[Chat] Processing ${pendingMessages.value.size} pending messages`);
    const entries = [...pendingMessages.value.entries()];

    for (const [tempId, queuedMsg] of entries) {
      // Update status to sending
      queuedMsg.status = 'sending';
      messageStatus.value.set(tempId, 'sending');

      const socket = getSocket();
      if (!socket || !isConnected()) {
        // Still offline, mark as failed
        queuedMsg.status = 'failed';
        queuedMsg.error = '连接已断开';
        messageStatus.value.set(tempId, 'failed');
        failedMessages.value.set(tempId, queuedMsg);
        pendingMessages.value.delete(tempId);
        continue;
      }

      // Set up acknowledgment listener
      const ackTimeout = setTimeout(() => {
        // Timeout - mark as failed
        queuedMsg.status = 'failed';
        queuedMsg.error = '发送超时';
        messageStatus.value.set(tempId, 'failed');
        failedMessages.value.set(tempId, queuedMsg);
        pendingMessages.value.delete(tempId);
        ElMessage.error('消息发送超时，请点击重试');

        // Trigger reactivity
        pendingMessages.value = new Map(pendingMessages.value);
        failedMessages.value = new Map(failedMessages.value);
        messageStatus.value = new Map(messageStatus.value);
      }, 10000);

      socket.emit('sendMessage', queuedMsg.payload, (ack: { success: boolean; error?: string }) => {
        clearTimeout(ackTimeout);

        if (ack.success) {
          // Remove from pending
          pendingMessages.value.delete(tempId);
          messageStatus.value.set(tempId, 'sent');
        } else {
          // Move to failed
          queuedMsg.status = 'failed';
          queuedMsg.error = ack.error ?? '发送失败';
          messageStatus.value.set(tempId, 'failed');
          failedMessages.value.set(tempId, queuedMsg);
          pendingMessages.value.delete(tempId);
          ElMessage.error(`消息发送失败: ${queuedMsg.error}`);
        }

        // Trigger reactivity
        pendingMessages.value = new Map(pendingMessages.value);
        failedMessages.value = new Map(failedMessages.value);
        messageStatus.value = new Map(messageStatus.value);
      });
    }

    // Trigger reactivity
    pendingMessages.value = new Map(pendingMessages.value);
    messageStatus.value = new Map(messageStatus.value);
  }

  // ============================================
  // Actions
  // ============================================

  /**
   * Connect to WebSocket server and register event handlers
   */
  async function connectSocket(): Promise<void> {
    // Set up reconnect callback to process pending messages
    setOnReconnect(() => {
      isSocketConnected.value = true;
      processPendingMessages();
    });

    // Set up token refresh callback for re-authentication
    setOnTokenRefresh(async () => {
      return refreshAccessToken();
    });

    try {
      const socket = await connect();
      isSocketConnected.value = true;
      registerSocketEvents(socket);

      // Auto-join all rooms on connect to receive messages
      await fetchRooms();
      for (const room of rooms.value) {
        console.log('[Chat] Auto-joining room:', room.room.id);
        socket.emit('joinRoom', { roomId: room.room.id }, (res: { success: boolean }) => {
          console.log('[Chat] Auto-join response for', room.room.id, ':', res);
        });
      }

      // Handle disconnect
      socket.on('disconnect', () => {
        isSocketConnected.value = false;
        unregisterSocketEvents(socket);
      });
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'WebSocket connection failed';
      throw err;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  function disconnectSocket(): void {
    const socket = getSocket();
    if (socket) {
      unregisterSocketEvents(socket);
    }
    disconnect();
    isSocketConnected.value = false;
  }

  /**
   * Fetch all rooms for current user
   */
  async function fetchRooms(): Promise<void> {
    isLoadingRooms.value = true;
    error.value = null;

    try {
      const response = await getRooms();
      // Filter out hidden private rooms
      const hidden = hiddenRoomIds.value;
      rooms.value = response.data.data.filter((room) => !hidden.has(room.room.id));

      // Initialize unread counts from room data
      rooms.value.forEach((room) => {
        unreadCounts.value.set(room.room.id, room.unreadCount);
        initRoomData(room.room.id);
      });
      // Trigger reactivity
      unreadCounts.value = new Map(unreadCounts.value);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch rooms';
      throw err;
    } finally {
      isLoadingRooms.value = false;
    }
  }

  /**
   * Join a chat room via WebSocket
   */
  function joinRoom(roomId: string): void {
    const socket = getSocket();
    if (!socket || !isConnected()) {
      throw new Error('Socket not connected');
    }

    socket.emit('joinRoom', { roomId });
    currentRoomId.value = roomId;
    initRoomData(roomId);

    // Mark messages as read
    markAsRead(roomId);

    // Load historical messages for the room
    fetchMessages(roomId);
  }

  /**
   * Leave a room
   * - Group rooms: Call REST API to actually leave
   * - Private rooms: Just hide from local view (no API call)
   */
  async function leaveRoom(roomId: string): Promise<void> {
    const roomIndex = rooms.value.findIndex((r) => r.room.id === roomId);
    if (roomIndex === -1) return;

    const roomData = rooms.value[roomIndex];
    const isPrivate = roomData.room.type === 'private';

    if (isPrivate) {
      // Private room: just hide from local view
      hiddenRoomIds.value.add(roomId);
      hiddenRoomIds.value = new Set(hiddenRoomIds.value);
      saveHiddenRoomIds();
      // Also remove from rooms array so UI updates immediately
      rooms.value.splice(roomIndex, 1);
    } else {
      // Group room: call REST API to actually leave
      try {
        await leaveRoomApi(roomId);
        // Remove from rooms array
        rooms.value.splice(roomIndex, 1);
      } catch (error) {
        const apiError = extractApiError(error);
        ElMessage.error(apiError.displayMessage);
        throw error;
      }
    }

    // Cleanup related state
    messagesByRoom.value.delete(roomId);
    onlineUsersByRoom.value.delete(roomId);
    typingUsersByRoom.value.delete(roomId);
    unreadCounts.value.delete(roomId);
    pendingMessages.value.delete(roomId);
    failedMessages.value.delete(roomId);
    hasMoreByRoom.value.delete(roomId);
    nextCursorByRoom.value.delete(roomId);

    // Trigger reactivity
    messagesByRoom.value = new Map(messagesByRoom.value);
    onlineUsersByRoom.value = new Map(onlineUsersByRoom.value);
    typingUsersByRoom.value = new Map(typingUsersByRoom.value);
    unreadCounts.value = new Map(unreadCounts.value);
    pendingMessages.value = new Map(pendingMessages.value);
    failedMessages.value = new Map(failedMessages.value);
    hasMoreByRoom.value = new Map(hasMoreByRoom.value);
    nextCursorByRoom.value = new Map(nextCursorByRoom.value);

    // Clear current room if it's the one we're leaving
    if (currentRoomId.value === roomId) {
      currentRoomId.value = null;
    }
  }

  /**
   * Send a message via WebSocket with offline queue support
   * @returns Temporary message ID for tracking
   */
  function sendMessage(payload: SendMessagePayload): string {
    const tempId = generateTempId();
    const queuedMsg: QueuedMessage = {
      tempId,
      payload,
      status: 'pending',
      error: null,
      queuedAt: Date.now(),
    };

    const socket = getSocket();
    if (!socket || !isConnected()) {
      // Queue message for later when offline
      pendingMessages.value.set(tempId, queuedMsg);
      messageStatus.value.set(tempId, 'pending');
      pendingMessages.value = new Map(pendingMessages.value);
      messageStatus.value = new Map(messageStatus.value);
      ElMessage.warning('连接已断开，消息将在重连后发送');
      return tempId;
    }

    // Update status to sending
    queuedMsg.status = 'sending';
    messageStatus.value.set(tempId, 'sending');
    messageStatus.value = new Map(messageStatus.value);

    // Add message optimistically to local state for immediate display
    const authStore = useAuthStore();
    const optimisticMessage: MessageResponse = {
      id: tempId,
      roomId: payload.roomId,
      senderId: authStore.user?.id ?? '',
      type: payload.type as MessageResponse['type'],
      content: payload.content,
      metadata: payload.metadata ?? null,
      replyToId: payload.replyToId ?? null,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    };

    initRoomData(payload.roomId);
    const roomMessages = messagesByRoom.value.get(payload.roomId);
    if (roomMessages) {
      // Use unshift: 消息存储为 DESC 顺序（最新在前），新消息应插入数组头部
      roomMessages.unshift(optimisticMessage);
      messagesByRoom.value.set(payload.roomId, [...roomMessages]);
    }

    // Send with acknowledgment
    socket.emit('sendMessage', payload, (ack: { success: boolean; error?: string }) => {
      if (ack.success) {
        messageStatus.value.set(tempId, 'sent');
      } else {
        queuedMsg.status = 'failed';
        queuedMsg.error = ack.error ?? '发送失败';
        messageStatus.value.set(tempId, 'failed');
        failedMessages.value.set(tempId, queuedMsg);
        ElMessage.error(`消息发送失败: ${queuedMsg.error}`);
      }
      messageStatus.value = new Map(messageStatus.value);
      failedMessages.value = new Map(failedMessages.value);
    });

    return tempId;
  }

  /**
   * Retry a failed message
   */
  function retryMessage(tempId: string): void {
    const failedMsg = failedMessages.value.get(tempId);
    if (!failedMsg) {
      ElMessage.error('找不到该消息');
      return;
    }

    // Remove from failed and retry
    failedMessages.value.delete(tempId);
    failedMessages.value = new Map(failedMessages.value);

    // Re-send the message
    sendMessage(failedMsg.payload);
  }

  /**
   * Clear a failed message (dismiss without retry)
   */
  function clearFailedMessage(tempId: string): void {
    failedMessages.value.delete(tempId);
    messageStatus.value.delete(tempId);
    failedMessages.value = new Map(failedMessages.value);
    messageStatus.value = new Map(messageStatus.value);
  }

  /**
   * Edit a message via WebSocket
   */
  function editMessage(payload: EditMessagePayload): void {
    const socket = getSocket();
    if (!socket || !isConnected()) {
      throw new Error('Socket not connected');
    }

    socket.emit('editMessage', payload);
  }

  /**
   * Send typing indicator via WebSocket
   */
  function sendTyping(payload: TypingPayload): void {
    const socket = getSocket();
    if (!socket || !isConnected()) {
      return; // Silently fail for typing indicators
    }

    socket.emit('typing', payload);
  }

  /**
   * Mark messages as read via WebSocket
   */
  function markAsRead(roomId: string): void {
    const socket = getSocket();
    if (!socket || !isConnected()) {
      throw new Error('Socket not connected');
    }

    socket.emit('markRead', { roomId });
    updateUnreadCount(roomId, 0);
  }

  /**
   * Fetch messages for a room via REST API
   */
  async function fetchMessages(roomId: string, cursor?: string, limit?: number): Promise<void> {
    // 区分加载更多和初始加载
    if (cursor) {
      isLoadingMore.value = true;
    } else {
      isLoadingMessages.value = true;
    }
    error.value = null;

    try {
      const response = await getRoomMessages(roomId, {
        cursor,
        limit,
        // 移除 order: 'ASC'，使用后端默认 DESC
      });

      initRoomData(roomId);

      // 存储分页信息
      hasMoreByRoom.value.set(roomId, response.data.hasMore);
      nextCursorByRoom.value.set(roomId, response.data.nextCursor);
      // 触发响应式
      hasMoreByRoom.value = new Map(hasMoreByRoom.value);
      nextCursorByRoom.value = new Map(nextCursorByRoom.value);

      const existingMessages = messagesByRoom.value.get(roomId) ?? [];

      if (cursor) {
        // APPEND 消息：新加载的更老消息追加到末尾（DESC 顺序)
        messagesByRoom.value.set(roomId, [...existingMessages, ...response.data.data]);
      } else {
        // Initial load - replace messages (DESC: 最新在前)
        messagesByRoom.value.set(roomId, response.data.data);
      }
      // Messages stored in messagesByRoom, no return value needed
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch messages';
      throw err;
    } finally {
      if (cursor) {
        isLoadingMore.value = false;
      } else {
        isLoadingMessages.value = false;
      }
    }
  }

  /**
   * Fetch room members via REST API
   */
  async function fetchRoomMembers(roomId: string): Promise<
    Array<{
      id: string;
      roomId: string;
      userId: string;
      role: 'owner' | 'admin' | 'member';
      joinedAt: string;
      lastReadAt: string;
      user?: {
        id: string;
        username: string;
        nickname: string | null;
        avatarUrl: string | null;
      };
    }>
  > {
    try {
      const response = await getRoomMembersApi(roomId);
      return response.data.data;
    } catch (error) {
      const apiError = extractApiError(error);
      ElMessage.error(apiError.displayMessage);
      throw error;
    }
  }

  /**
   * Remove a member from a room (admin/owner only)
   */
  async function removeRoomMember(roomId: string, userId: string): Promise<void> {
    try {
      await removeRoomMemberApi(roomId, userId);
      // Refresh members list
      await fetchRoomMembers(roomId);
    } catch (error) {
      const apiError = extractApiError(error);
      ElMessage.error(apiError.displayMessage);
      throw error;
    }
  }

  /**
   * Clear all chat state (e.g., on logout)
   */
  function clearState(): void {
    // Clear socket callbacks
    setOnReconnect(null);
    setOnTokenRefresh(null);

    disconnectSocket();
    rooms.value = [];
    currentRoomId.value = null;
    messagesByRoom.value = new Map();
    onlineUsersByRoom.value = new Map();
    typingUsersByRoom.value = new Map();
    unreadCounts.value = new Map();
    pendingMessages.value = new Map();
    failedMessages.value = new Map();
    messageStatus.value = new Map();
    hasMoreByRoom.value = new Map();
    nextCursorByRoom.value = new Map();
    isLoadingMore.value = false;
    error.value = null;
    isLoadingRooms.value = false;
    isLoadingMessages.value = false;
  }

  return {
    // State
    rooms,
    hiddenRoomIds,
    currentRoomId,
    messagesByRoom,
    onlineUsersByRoom,
    typingUsersByRoom,
    unreadCounts,
    isLoadingRooms,
    isLoadingMessages,
    hasMoreByRoom,
    nextCursorByRoom,
    isLoadingMore,
    error,
    isSocketConnected,
    pendingMessages,
    failedMessages,
    messageStatus,

    // Computed
    currentRoom,
    currentMessages,
    currentTypingUsers,
    currentOnlineUsers,
    totalUnreadCount,
    visibleRooms,

    // Actions
    connectSocket,
    disconnectSocket,
    fetchRooms,
    joinRoom,
    leaveRoom,
    sendMessage,
    editMessage,
    sendTyping,
    markAsRead,
    fetchMessages,
    fetchRoomMembers,
    removeRoomMember,
    clearState,
    requestNotificationPermission,
    retryMessage,
    clearFailedMessage,
  };
});
