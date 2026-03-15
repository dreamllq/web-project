<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useChatStore } from '@/stores/chat';
import { extractApiError } from '@/api';
import { ChatDotRound } from '@element-plus/icons-vue';
import RoomList from '@/components/chat/RoomList.vue';
import MessageList from '@/components/chat/MessageList.vue';
import MessageInput from '@/components/chat/MessageInput.vue';
import RoomHeader from '@/components/chat/RoomHeader.vue';
import CreateRoomDialog from '@/components/chat/CreateRoomDialog.vue';
import SearchDialog from '@/components/chat/SearchDialog.vue';
import FileUpload from '@/components/chat/FileUpload.vue';

// ============================================
// Composables
// ============================================
const { t } = useI18n();
const chatStore = useChatStore();

// ============================================
// State (for future dialogs from Wave 4)
// ============================================
const showCreateRoomDialog = ref(false);
const showSearchDialog = ref(false);
const showUploadDialog = ref(false);

// ============================================
// Event Handlers
// ============================================
function handleOpenSearch(): void {
  showSearchDialog.value = true;
}

function handleOpenUpload(): void {
  showUploadDialog.value = true;
}

function handleMessageSent(_content: string): void {
  // Message already sent by MessageInput component via store
  // This handler is for any additional logic needed after message send
}

function handleRoomCreated(): void {
  // Refresh rooms list after creating a new room
  chatStore.fetchRooms();
  showCreateRoomDialog.value = false;
}

function handleMessageSelect(_messageId: string): void {
  // Close dialog - MessageList component handles scrolling via message ID in URL or store
  showSearchDialog.value = false;
}

function handleUploadSuccess(fileUrl: string): void {
  // Send file message via store with proper payload
  if (chatStore.currentRoomId) {
    chatStore.sendMessage({
      roomId: chatStore.currentRoomId,
      content: fileUrl,
      type: 'file',
    });
  }
  showUploadDialog.value = false;
}

// ============================================
// Lifecycle
// ============================================
onMounted(async () => {
  try {
    // Connect to WebSocket server
    await chatStore.connectSocket();
    // Fetch rooms after socket connection
    await chatStore.fetchRooms();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
});

onUnmounted(() => {
  // Disconnect socket when leaving the page
  chatStore.disconnectSocket();
});
</script>

<template>
  <div class="chat-page">
    <el-container v-loading="chatStore.isLoadingRooms" class="chat-container">
      <!-- Left Sidebar: Room List -->
      <el-aside width="260px" class="room-sidebar">
        <div class="sidebar-header">
          <h3>{{ t('chat.roomList') }}</h3>
          <el-button type="primary" size="small" @click="showCreateRoomDialog = true">
            {{ t('chat.createRoom') }}
          </el-button>
        </div>
        <RoomList />
      </el-aside>

      <!-- Right Main Area: Chat Area -->
      <el-main class="chat-main">
        <template v-if="chatStore.currentRoom">
          <!-- Room Header -->
          <RoomHeader @search="handleOpenSearch" />

          <!-- Message List -->
          <MessageList />

          <!-- Message Input -->
          <MessageInput @send="handleMessageSent" @upload="handleOpenUpload" />
        </template>

        <!-- Empty State: No Room Selected -->
        <el-empty v-else :description="t('chat.selectRoom')" :image-size="160">
          <template #image>
            <el-icon :size="80" color="#c0c4cc"><ChatDotRound /></el-icon>
          </template>
        </el-empty>
      </el-main>
    </el-container>

    <!-- Create Room Dialog -->
    <CreateRoomDialog v-model="showCreateRoomDialog" @success="handleRoomCreated" />

    <!-- Search Dialog -->
    <SearchDialog
      v-model="showSearchDialog"
      :room-id="chatStore.currentRoomId ?? ''"
      @select="handleMessageSelect"
    />

    <!-- File Upload Dialog -->
    <FileUpload v-model="showUploadDialog" @success="handleUploadSuccess" />
  </div>
</template>

<style scoped>
.chat-page {
  height: calc(100vh - 120px);
  padding: 0;
}

.chat-container {
  height: 100%;
  background-color: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

/* Sidebar Styles */
.room-sidebar {
  background-color: #f5f7fa;
  border-right: 1px solid #ebeef5;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #ebeef5;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

/* Main Chat Area Styles */
.chat-main {
  display: flex;
  flex-direction: column;
  padding: 0;
  background-color: #fff;
}

/* Empty State */
:deep(.el-empty) {
  padding: 40px 0;
}

:deep(.el-empty__description) {
  margin-top: 12px;
}
</style>
