<script setup lang="ts">
import { computed, ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useChatStore } from '@/stores/chat';
import { useAuthStore } from '@/stores/auth';
import { Document, Picture, ChatDotRound, WarningFilled, ArrowDown } from '@element-plus/icons-vue';
import type { MessageResponse } from '@/types/chat';

// ============================================
// Composables
// ============================================
const { t } = useI18n();
const chatStore = useChatStore();
const authStore = useAuthStore();

// ============================================
// Refs
// ============================================
const scrollerRef = ref<InstanceType<typeof import('vue-virtual-scroller').DynamicScroller>>();
const isAtBottom = ref(true);
const showScrollButton = ref(false);
const isInitialLoad = ref(true);

// ============================================
// Computed
// ============================================
const messages = computed<MessageResponse[]>(() => chatStore.currentMessages);

const currentUserId = computed<string | null>(() => authStore.user?.id ?? null);

const isLoading = computed(() => chatStore.isLoadingMessages);

// ============================================
// Methods
// ============================================

/**
 * Check if message is from current user
 */
function isMyMessage(message: MessageResponse): boolean {
  return message.senderId === currentUserId.value;
}

/**
 * Check if message is deleted
 */
function isDeleted(message: MessageResponse): boolean {
  return message.deletedAt !== null;
}

/**
 * Check if message is edited
 */
function isEdited(message: MessageResponse): boolean {
  return message.editedAt !== null && !isDeleted(message);
}

/**
 * Check if message is a system message
 */
function isSystemMessage(message: MessageResponse): boolean {
  return message.type === 'system';
}

/**
 * Format message time
 */
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
  }

  return date.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get message type icon
 */
function getMessageTypeIcon(type: string) {
  switch (type) {
    case 'image':
      return Picture;
    case 'file':
      return Document;
    case 'system':
      return WarningFilled;
    default:
      return ChatDotRound;
  }
}

/**
 * Get message type label
 */
function getMessageTypeLabel(type: string): string {
  switch (type) {
    case 'image':
      return t('chat.image');
    case 'file':
      return t('chat.file');
    case 'system':
      return t('chat.system');
    default:
      return t('chat.text');
  }
}

/**
 * Get file name from metadata
 */
function getFileName(message: MessageResponse): string {
  if (message.metadata && typeof message.metadata.fileName === 'string') {
    return message.metadata.fileName;
  }
  return t('chat.file');
}

/**
 * Get file size from metadata
 */
function getFileSize(message: MessageResponse): string {
  if (message.metadata && typeof message.metadata.fileSize === 'number') {
    const size = message.metadata.fileSize;
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  return '';
}

/**
 * Scroll to bottom of message list
 */
function scrollToBottom(): void {
  nextTick(() => {
    if (scrollerRef.value && messages.value.length > 0) {
      scrollerRef.value.scrollToItem(messages.value.length - 1);
      isAtBottom.value = true;
      showScrollButton.value = false;
    }
  });
}

/**
 * Handle scroll event to detect if user is at bottom
 */
function handleScroll(): void {
  if (!scrollerRef.value) return;

  const scrollerEl = scrollerRef.value.$el;
  if (!scrollerEl) return;

  const { scrollTop, scrollHeight, clientHeight } = scrollerEl;
  const isBottom = scrollHeight - scrollTop - clientHeight < 50;

  isAtBottom.value = isBottom;
  showScrollButton.value = !isBottom && !isInitialLoad.value;
}

/**
 * Check if should auto-scroll to bottom
 */
function shouldAutoScroll(): boolean {
  return isAtBottom.value;
}

// ============================================
// Watchers
// ============================================

// Auto-scroll to bottom when new messages arrive (only if user is at bottom)
watch(
  () => chatStore.currentMessages.length,
  (newLength, oldLength) => {
    // Initial load - always scroll to bottom
    if (isInitialLoad.value && newLength > 0) {
      nextTick(() => {
        scrollToBottom();
        isInitialLoad.value = false;
      });
      return;
    }

    // New message arrived - only scroll if user is at bottom
    if (newLength > (oldLength ?? 0) && shouldAutoScroll()) {
      scrollToBottom();
    }
  }
);

// Reset state when room changes
watch(
  () => chatStore.currentRoomId,
  () => {
    isInitialLoad.value = true;
    showScrollButton.value = false;
    isAtBottom.value = true;
  }
);

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  // Scroll to bottom on initial mount if messages exist
  if (messages.value.length > 0) {
    nextTick(() => {
      scrollToBottom();
      isInitialLoad.value = false;
    });
  }

  // Add scroll event listener to scroller element
  nextTick(() => {
    if (scrollerRef.value?.$el) {
      scrollerRef.value.$el.addEventListener('scroll', handleScroll);
    }
  });
});

// Cleanup scroll listener on unmount
onUnmounted(() => {
  if (scrollerRef.value?.$el) {
    scrollerRef.value.$el.removeEventListener('scroll', handleScroll);
  }
});
</script>

<template>
  <div class="message-list" v-loading="isLoading">
    <!-- Empty State -->
    <el-empty v-if="messages.length === 0" :description="t('chat.noMessages')" :image-size="100" />

    <!-- Virtual Scroller -->
    <DynamicScroller
      v-else
      ref="scrollerRef"
      :items="messages"
      :min-item-size="60"
      key-field="id"
      class="scroller"
    >
      <template #default="{ item: message, active }">
        <DynamicScrollerItem
          :item="message"
          :active="active"
          :size-dependencies="[message.content, message.type, message.deletedAt]"
        >
          <div class="message-wrapper">
            <div
              class="message-item"
              :class="{
                'my-message': isMyMessage(message),
                'system-message': isSystemMessage(message),
                'deleted-message': isDeleted(message),
              }"
            >
              <!-- System Message -->
              <template v-if="isSystemMessage(message)">
                <div class="system-message-content">
                  <el-icon class="system-icon"><WarningFilled /></el-icon>
                  <span>{{ message.content }}</span>
                </div>
                <span class="message-time">{{ formatTime(message.createdAt) }}</span>
              </template>

              <!-- Deleted Message -->
              <template v-else-if="isDeleted(message)">
                <div class="deleted-content">
                  <el-icon><WarningFilled /></el-icon>
                  <span>{{ t('chat.deleteMessage') }}</span>
                </div>
                <span class="message-time">{{ formatTime(message.createdAt) }}</span>
              </template>

              <!-- Normal Message -->
              <template v-else>
                <!-- Message Header -->
                <div class="message-header">
                  <span class="sender-id">{{
                    isMyMessage(message) ? '我' : message.senderName || message.senderId.slice(0, 8)
                  }}</span>
                  <span class="message-time">{{ formatTime(message.createdAt) }}</span>
                </div>

                <!-- Message Content -->
                <div class="message-content">
                  <!-- Text Message -->
                  <template v-if="message.type === 'text' || message.type === 'emoji'">
                    <span class="text-content">{{ message.content }}</span>
                  </template>

                  <!-- Image Message -->
                  <template v-else-if="message.type === 'image'">
                    <div class="image-message">
                      <el-icon class="type-icon"><Picture /></el-icon>
                      <span>{{ message.content || t('chat.image') }}</span>
                    </div>
                  </template>

                  <!-- File Message -->
                  <template v-else-if="message.type === 'file'">
                    <div class="file-message">
                      <el-icon class="type-icon"><Document /></el-icon>
                      <div class="file-info">
                        <span class="file-name">{{ getFileName(message) }}</span>
                        <span v-if="getFileSize(message)" class="file-size">{{
                          getFileSize(message)
                        }}</span>
                      </div>
                    </div>
                  </template>

                  <!-- Unknown Message Type -->
                  <template v-else>
                    <div class="unknown-message">
                      <el-icon class="type-icon"
                        ><component :is="getMessageTypeIcon(message.type)"
                      /></el-icon>
                      <span>[{{ getMessageTypeLabel(message.type) }}]</span>
                    </div>
                  </template>

                  <!-- Edited Indicator -->
                  <span v-if="isEdited(message)" class="edited-indicator">{{
                    t('chat.editMessage')
                  }}</span>
                </div>
              </template>
            </div>
          </div>
        </DynamicScrollerItem>
      </template>
    </DynamicScroller>

    <!-- Scroll to Bottom Button -->
    <transition name="fade">
      <button
        v-if="showScrollButton"
        class="scroll-to-bottom-btn"
        @click="scrollToBottom"
        :title="t('chat.scrollToBottom')"
      >
        <el-icon :size="20"><ArrowDown /></el-icon>
        <span class="new-message-badge">新消息</span>
      </button>
    </transition>
  </div>
</template>

<style scoped>
.message-list {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

.scroller {
  flex: 1;
  padding: 16px 20px;
}

.message-wrapper {
  padding: 6px 0;
}

.message-item {
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  background-color: #f5f7fa;
  border-radius: 8px;
  max-width: 70%;
  word-break: break-word;
}

.message-item:not(.my-message):not(.system-message) {
  margin-right: auto;
}

.message-item.my-message {
  margin-left: auto;
  background-color: #e6f0ff;
}

.message-item.my-message .message-header {
  flex-direction: row-reverse;
}

.message-item.my-message .message-content {
  text-align: right;
}

.message-item.my-message .text-content {
  text-align: right;
}

.message-item.system-message {
  margin-left: auto;
  margin-right: auto;
  max-width: 90%;
  background-color: transparent;
  padding: 8px 16px;
}

.message-item.deleted-message {
  opacity: 0.6;
  font-style: italic;
}

/* Message Header */
.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  gap: 12px;
}

.sender-id {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
}

.message-time {
  font-size: 11px;
  color: #909399;
  flex-shrink: 0;
}

/* Message Content */
.message-content {
  position: relative;
}

.text-content {
  font-size: 14px;
  color: #303133;
  line-height: 1.5;
}

/* System Message */
.system-message-content {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #909399;
}

.system-icon {
  color: #e6a23c;
}

/* Deleted Message */
.deleted-content {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #909399;
}

/* Image Message */
.image-message {
  display: flex;
  align-items: center;
  gap: 8px;
}

.type-icon {
  font-size: 20px;
  color: #409eff;
}

/* File Message */
.file-message {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background-color: rgba(0, 0, 0, 0.04);
  border-radius: 6px;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
}

.file-size {
  font-size: 11px;
  color: #909399;
}

/* Unknown Message */
.unknown-message {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #909399;
}

/* Edited Indicator */
.edited-indicator {
  display: inline-block;
  margin-left: 8px;
  font-size: 11px;
  color: #909399;
  font-style: italic;
}

/* Empty State */
:deep(.el-empty) {
  padding: 40px 0;
}

:deep(.el-empty__description) {
  margin-top: 12px;
}

/* Scroll to Bottom Button */
.scroll-to-bottom-btn {
  position: absolute;
  bottom: 20px;
  right: 20px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: #fff;
  border: 1px solid #dcdfe6;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #606266;
  transition: all 0.3s ease;
  z-index: 10;
}

.scroll-to-bottom-btn:hover {
  background-color: #409eff;
  border-color: #409eff;
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.3);
}

.new-message-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background-color: #f56c6c;
  color: #fff;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  white-space: nowrap;
}

/* Fade Transition */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
