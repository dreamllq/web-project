<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ChatDotRound, Search, MoreFilled, User } from '@element-plus/icons-vue';
import { useChatStore } from '@/stores/chat';

// ============================================
// Composables
// ============================================
const { t } = useI18n();
const chatStore = useChatStore();

// ============================================
// Emits
// ============================================
const emit = defineEmits<{
  (e: 'search'): void;
}>();

// ============================================
// Computed
// ============================================
const currentRoom = computed(() => chatStore.currentRoom);

const roomName = computed(() => {
  if (!currentRoom.value) return '';
  return currentRoom.value.room.name ?? t('chat.privateRoom');
});

const roomTypeLabel = computed(() => {
  if (!currentRoom.value) return '';
  const type = currentRoom.value.room.type;
  switch (type) {
    case 'private':
      return t('chat.privateRoom');
    case 'group':
      return t('chat.publicRoom');
    case 'broadcast':
      return t('chat.publicRoom');
    default:
      return '';
  }
});

const onlineCount = computed(() => {
  return chatStore.currentOnlineUsers.size;
});

const hasOnlineUsers = computed(() => onlineCount.value > 0);

// ============================================
// Methods
// ============================================
function handleSearch() {
  emit('search');
}

function handleManageMembers() {
  // TODO: Implement members management dialog
  ElMessage.info(t('chat.members'));
}

async function handleLeaveRoom() {
  if (!currentRoom.value) return;

  try {
    await ElMessageBox.confirm(t('chat.leaveRoom') + '?', {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    });

    chatStore.leaveRoom(currentRoom.value.room.id);
    ElMessage.success(t('chat.leaveRoom'));
  } catch {
    // User cancelled
  }
}
</script>

<template>
  <div class="room-header">
    <div class="header-left">
      <div class="room-title">
        <el-icon :size="20"><ChatDotRound /></el-icon>
        <span class="room-name">{{ roomName }}</span>
      </div>
      <div class="room-meta">
        <span class="room-type">{{ roomTypeLabel }}</span>
        <span v-if="hasOnlineUsers" class="online-indicator">
          <span class="online-dot"></span>
          {{ onlineCount }} {{ t('chat.online') }}
        </span>
      </div>
    </div>

    <div class="header-actions">
      <el-button
        :icon="Search"
        circle
        size="small"
        :title="t('chat.search')"
        @click="handleSearch"
      />

      <el-dropdown trigger="click" placement="bottom-end">
        <el-button :icon="MoreFilled" circle size="small" />
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item :icon="User" @click="handleManageMembers">
              {{ t('chat.members') }}
            </el-dropdown-item>
            <el-dropdown-item divided @click="handleLeaveRoom">
              {{ t('chat.leaveRoom') }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </div>
</template>

<style scoped>
.room-header {
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
}

.header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.room-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.room-title .el-icon {
  color: #409eff;
  flex-shrink: 0;
}

.room-name {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #909399;
}

.room-type {
  padding: 2px 8px;
  background-color: #f0f2f5;
  border-radius: 4px;
}

.online-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #67c23a;
}

.online-dot {
  width: 6px;
  height: 6px;
  background-color: #67c23a;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.header-actions .el-button {
  border: none;
  background-color: transparent;
}

.header-actions .el-button:hover {
  background-color: #f0f2f5;
}
</style>
