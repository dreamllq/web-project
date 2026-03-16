<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { User, ChatDotRound, Promotion } from '@element-plus/icons-vue';
import { useChatStore } from '@/stores/chat';
import type { RoomType, UserRoomResponse } from '@/types/chat';

// ============================================
// Composables
// ============================================
const { t } = useI18n();
const chatStore = useChatStore();

// ============================================
// Computed
// ============================================

/** Get icon component based on room type */
function getRoomIcon(type: RoomType) {
  switch (type) {
    case 'private':
      return User;
    case 'group':
      return ChatDotRound;
    case 'broadcast':
      return Promotion;
    default:
      return ChatDotRound;
  }
}

/** Get room type label */
function getRoomTypeLabel(type: RoomType): string {
  switch (type) {
    case 'private':
      return t('chat.privateRoom');
    case 'group':
      return t('chat.publicRoom');
    case 'broadcast':
      return 'Broadcast';
    default:
      return '';
  }
}

/** Get display name for room */
function getRoomDisplayName(userRoom: UserRoomResponse): string {
  // For private rooms, show other user's name
  if (userRoom.room.type === 'private' && userRoom.otherUser) {
    return userRoom.otherUser.nickname || userRoom.otherUser.username;
  }
  return userRoom.room.name || getRoomTypeLabel(userRoom.room.type);
}

/** Check if room has online users */
function hasOnlineUsers(roomId: string): boolean {
  const onlineUsers = chatStore.onlineUsersByRoom.get(roomId);
  return onlineUsers ? onlineUsers.size > 0 : false;
}

/** Handle room selection */
function handleRoomSelect(roomId: string): void {
  chatStore.joinRoom(roomId);
}
</script>

<template>
  <div class="room-list">
    <!-- Room List -->
    <template v-if="chatStore.rooms.length > 0">
      <div
        v-for="userRoom in chatStore.rooms"
        :key="userRoom.room.id"
        class="room-item"
        :class="{ active: chatStore.currentRoomId === userRoom.room.id }"
        @click="handleRoomSelect(userRoom.room.id)"
      >
        <div class="room-avatar">
          <el-icon :size="20">
            <component :is="getRoomIcon(userRoom.room.type)" />
          </el-icon>
          <!-- Online indicator -->
          <span
            v-if="hasOnlineUsers(userRoom.room.id)"
            class="online-indicator"
            :title="t('chat.online')"
          ></span>
        </div>

        <div class="room-info">
          <div class="room-header">
            <span class="room-name">
              {{ getRoomDisplayName(userRoom) }}
            </span>
            <el-badge
              v-if="userRoom.unreadCount > 0"
              :value="userRoom.unreadCount > 99 ? '99+' : userRoom.unreadCount"
              :max="99"
              class="unread-badge"
            />
          </div>
          <div class="room-meta">
            <span class="room-type">{{ getRoomTypeLabel(userRoom.room.type) }}</span>
          </div>
        </div>
      </div>
    </template>

    <!-- Empty State -->
    <el-empty v-else :description="t('chat.noRooms')" :image-size="80" />
  </div>
</template>

<style scoped>
.room-list {
  height: 100%;
  overflow-y: auto;
  padding: 8px;
}

.room-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-bottom: 4px;
}

.room-item:hover {
  background-color: #e8eaed;
}

.room-item.active {
  background-color: #e6f0ff;
}

.room-avatar {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #606266;
}

.room-item.active .room-avatar {
  background-color: #d9e8ff;
  color: #409eff;
}

.online-indicator {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  background-color: #67c23a;
  border: 2px solid #f5f7fa;
  border-radius: 50%;
}

.room-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.room-name {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a2e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-meta {
  display: flex;
  align-items: center;
}

.room-type {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-badge {
  flex-shrink: 0;
}

.unread-badge :deep(.el-badge__content) {
  font-size: 11px;
  height: 16px;
  line-height: 16px;
  padding: 0 5px;
}

/* Empty State */
:deep(.el-empty) {
  padding: 40px 0;
}

:deep(.el-empty__description) {
  margin-top: 12px;
}
</style>
