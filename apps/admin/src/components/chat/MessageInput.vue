<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Promotion, Paperclip, ChatDotRound } from '@element-plus/icons-vue';
import { useChatStore } from '@/stores/chat';
import type { SendMessagePayload } from '@/types/chat';

// ============================================
// Emits
// ============================================
const emit = defineEmits<{
  (e: 'send', content: string): void;
  (e: 'upload'): void;
}>();

// ============================================
// Composables
// ============================================
const { t } = useI18n();
const chatStore = useChatStore();

// ============================================
// State
// ============================================
const inputContent = ref('');
const isTyping = ref(false);
const showEmojiPicker = ref(false);
let typingTimeout: ReturnType<typeof setTimeout> | null = null;

// ============================================
// Emoji Picker
// ============================================
const emojiCategories = [
  {
    name: 'smileys',
    emojis: [
      '😀',
      '😃',
      '😄',
      '😁',
      '😅',
      '😂',
      '🤣',
      '😊',
      '😇',
      '🙂',
      '😉',
      '😌',
      '😍',
      '🥰',
      '😘',
      '😗',
      '😙',
      '😚',
      '😋',
      '😛',
      '😜',
      '🤪',
      '😝',
      '🤑',
      '🤗',
      '🤭',
      '🤫',
      '🤔',
      '🤐',
      '🤨',
      '😐',
      '😑',
      '😶',
      '😏',
      '😒',
      '🙄',
      '😬',
      '😮',
      '🤯',
      '😱',
      '🥵',
      '🥶',
      '😳',
      '🤡',
      '👻',
      '👽',
      '🤖',
    ],
  },
  {
    name: 'gestures',
    emojis: [
      '👍',
      '👎',
      '👌',
      '✌️',
      '🤞',
      '🤟',
      '🤘',
      '🤙',
      '👈',
      '👉',
      '👆',
      '👇',
      '☝️',
      '✋',
      '🤚',
      '🖐️',
      '🖖',
      '👋',
      '🤝',
      '✊',
      '👊',
      '🤛',
      '🤜',
      '👏',
      '🙌',
      '👐',
      '🤲',
      '🙏',
    ],
  },
  {
    name: 'hearts',
    emojis: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '🤍',
      '🤎',
      '💔',
      '❣️',
      '💕',
      '💗',
      '💖',
      '💘',
      '💝',
      '💟',
    ],
  },
  {
    name: 'objects',
    emojis: [
      '🎉',
      '🎊',
      '🎁',
      '🎈',
      '🎀',
      '🏆',
      '🎮',
      '🎯',
      '🎲',
      '📱',
      '💻',
      '⌨️',
      '🖱️',
      '💾',
      '📷',
      '📹',
      '🎥',
      '📺',
      '📻',
      '🎧',
      '🎤',
      '🎵',
      '🎶',
      '🔔',
      '💡',
      '🔥',
      '⭐',
      '🌟',
      '✨',
      '💫',
      '💥',
      '💢',
    ],
  },
];

function handleEmojiSelect(emoji: string): void {
  inputContent.value += emoji;
  showEmojiPicker.value = false;
  // Trigger typing indicator when adding emoji
  handleTypingStart();
}

// ============================================
// Computed
// ============================================
const isDisabled = computed(() => {
  return !chatStore.currentRoomId || !chatStore.isSocketConnected;
});

const canSend = computed(() => {
  return inputContent.value.trim().length > 0 && !isDisabled.value;
});

// ============================================
// Typing Indicator
// ============================================
function handleTypingStart(): void {
  if (isDisabled.value || !chatStore.currentRoomId) return;

  if (!isTyping.value) {
    isTyping.value = true;
    chatStore.sendTyping({
      roomId: chatStore.currentRoomId,
      isTyping: true,
    });
  }

  // Reset timeout
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }

  // Stop typing after 3 seconds of inactivity
  typingTimeout = setTimeout(() => {
    handleTypingStop();
  }, 3000);
}

function handleTypingStop(): void {
  if (!chatStore.currentRoomId) return;

  if (isTyping.value) {
    isTyping.value = false;
    chatStore.sendTyping({
      roomId: chatStore.currentRoomId,
      isTyping: false,
    });
  }

  if (typingTimeout) {
    clearTimeout(typingTimeout);
    typingTimeout = null;
  }
}

// ============================================
// Message Sending
// ============================================
function handleSend(): void {
  const content = inputContent.value.trim();
  if (!content || !chatStore.currentRoomId) return;

  const payload: SendMessagePayload = {
    roomId: chatStore.currentRoomId,
    content,
    type: 'text',
  };

  // Call store directly
  chatStore.sendMessage(payload);

  // Emit event for parent component
  emit('send', content);

  // Clear input and stop typing
  inputContent.value = '';
  handleTypingStop();
}

function handleKeyDown(event: KeyboardEvent): void {
  // Enter without Shift = send
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
  // Shift+Enter = new line (default behavior, do nothing)
}

function handleUpload(): void {
  emit('upload');
}

// ============================================
// Watchers
// ============================================
// Stop typing when room changes
watch(
  () => chatStore.currentRoomId,
  () => {
    handleTypingStop();
    inputContent.value = '';
  }
);

// Cleanup on unmount (handled by watch cleanup)
</script>

<template>
  <div class="message-input-wrapper">
    <!-- Typing Indicator -->
    <div v-if="chatStore.currentTypingUsers.size > 0" class="typing-indicator">
      <el-icon class="typing-icon"><ChatDotRound /></el-icon>
      <span class="typing-text">{{ t('chat.typing') }}</span>
    </div>

    <!-- Input Area -->
    <div class="input-area" :class="{ disabled: isDisabled }">
      <!-- File Upload Button -->
      <el-button
        :icon="Paperclip"
        circle
        :disabled="isDisabled"
        :title="t('chat.file')"
        @click="handleUpload"
      />

      <!-- Emoji Picker -->
      <el-popover
        v-model:visible="showEmojiPicker"
        placement="top"
        :width="320"
        trigger="click"
        :disabled="isDisabled"
      >
        <template #reference>
          <el-button circle :disabled="isDisabled" :title="t('chat.emoji')" class="emoji-button">
            😊
          </el-button>
        </template>
        <div class="emoji-picker">
          <div v-for="category in emojiCategories" :key="category.name" class="emoji-category">
            <div class="emoji-category-title">{{ t(`chat.emojiCategories.${category.name}`) }}</div>
            <div class="emoji-grid">
              <button
                v-for="emoji in category.emojis"
                :key="emoji"
                class="emoji-item"
                type="button"
                @click="handleEmojiSelect(emoji)"
              >
                {{ emoji }}
              </button>
            </div>
          </div>
        </div>
      </el-popover>

      <!-- Text Input -->
      <el-input
        v-model="inputContent"
        type="textarea"
        :rows="1"
        :autosize="{ minRows: 1, maxRows: 4 }"
        :placeholder="isDisabled ? '' : t('chat.sendMessage')"
        :disabled="isDisabled"
        resize="none"
        class="message-textarea"
        @input="handleTypingStart"
        @keydown="handleKeyDown"
        @blur="handleTypingStop"
      />

      <!-- Send Button -->
      <el-button
        type="primary"
        :icon="Promotion"
        circle
        :disabled="!canSend"
        :title="t('chat.sendMessage')"
        @click="handleSend"
      />
    </div>

    <!-- Disabled Hint -->
    <div v-if="isDisabled" class="disabled-hint">
      <template v-if="!chatStore.isSocketConnected">
        {{ t('chat.offline') }}
      </template>
      <template v-else-if="!chatStore.currentRoomId">
        {{ t('chat.noMessages') }}
      </template>
    </div>
  </div>
</template>

<style scoped>
.message-input-wrapper {
  padding: 12px 20px;
  background-color: #fafafa;
  border-top: 1px solid #ebeef5;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0 8px;
  font-size: 12px;
  color: #909399;
}

.typing-icon {
  animation: bounce 1s infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

.typing-text {
  color: #909399;
}

.input-area {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.input-area.disabled {
  opacity: 0.6;
}

.message-textarea {
  flex: 1;
}

.message-textarea :deep(.el-textarea__inner) {
  border-radius: 20px;
  padding: 10px 16px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  border-color: #dcdfe6;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}

.message-textarea :deep(.el-textarea__inner:focus) {
  border-color: #409eff;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
}

.message-textarea :deep(.el-textarea__inner:disabled) {
  background-color: #f5f7fa;
  cursor: not-allowed;
}

.disabled-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
  text-align: center;
}

.emoji-button {
  font-size: 18px;
  padding: 0;
  width: 32px;
  height: 32px;
}

.emoji-picker {
  max-height: 280px;
  overflow-y: auto;
}

.emoji-category {
  margin-bottom: 12px;
}

.emoji-category:last-child {
  margin-bottom: 0;
}

.emoji-category-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 4px;
}

.emoji-item {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 18px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s;
  padding: 0;
}

.emoji-item:hover {
  background-color: #f0f0f0;
}
</style>
