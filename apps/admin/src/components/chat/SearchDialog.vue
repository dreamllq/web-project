<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Search, ChatDotRound, Clock, User } from '@element-plus/icons-vue';
import { useChatStore } from '@/stores/chat';
import type { MessageResponse } from '@/types/chat';

// ============================================
// Props & Emits
// ============================================
interface Props {
  /** 对话框可见性 */
  modelValue: boolean;
  /** 当前房间 ID */
  roomId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  /** 选择消息时触发，返回消息 ID 用于导航 */
  (e: 'select', messageId: string): void;
}>();

// ============================================
// Composables
// ============================================
const { t } = useI18n();
const chatStore = useChatStore();

// ============================================
// State
// ============================================
/** 搜索关键词 */
const searchQuery = ref<string>('');
/** 搜索结果 */
const searchResults = ref<MessageResponse[]>([]);
/** 是否正在搜索 */
const isLoading = ref(false);
/** 防抖定时器 */
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// ============================================
// Computed
// ============================================
/** 对话框可见性双向绑定 */
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

/** 当前房间的消息列表 */
const roomMessages = computed<MessageResponse[]>(() => {
  return chatStore.messagesByRoom.get(props.roomId) ?? [];
});

/** 当前房间信息 */
const currentRoom = computed(() => {
  return chatStore.rooms.find((r) => r.room.id === props.roomId);
});

// ============================================
// Methods
// ============================================

/**
 * 格式化时间显示
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
 * 高亮显示搜索关键词
 */
function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;

  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  return text.replace(regex, '<mark class="highlight">$1</mark>');
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 执行搜索
 */
function performSearch(): void {
  const query = searchQuery.value.trim();

  if (!query) {
    searchResults.value = [];
    return;
  }

  isLoading.value = true;

  // 模拟搜索延迟，实际项目中可能是 API 调用
  setTimeout(() => {
    const results = roomMessages.value.filter((message) => {
      // 只搜索文本消息，排除已删除的消息
      if (message.type !== 'text' && message.type !== 'emoji') return false;
      if (message.deletedAt !== null) return false;
      if (!message.content) return false;

      return message.content.toLowerCase().includes(query.toLowerCase());
    });

    // 按时间倒序排列
    searchResults.value = results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    isLoading.value = false;
  }, 100);
}

/**
 * 处理搜索输入（带防抖）
 */
function handleSearchInput(): void {
  // 清除之前的定时器
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // 设置新的防抖定时器 (300ms)
  debounceTimer = setTimeout(() => {
    performSearch();
  }, 300);
}

/**
 * 手动触发搜索
 */
function handleSearch(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  performSearch();
}

/**
 * 选择搜索结果
 */
function handleSelectMessage(message: MessageResponse): void {
  emit('select', message.id);
  // 关闭对话框
  dialogVisible.value = false;
}

/**
 * 对话框关闭时重置状态
 */
function handleDialogClose(): void {
  // 清除防抖定时器
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

/**
 * 对话框打开时聚焦搜索框
 */
function handleDialogOpen(): void {
  // 重置搜索状态
  searchQuery.value = '';
  searchResults.value = [];
}

// ============================================
// Watchers
// ============================================

// 监听对话框关闭，重置状态
watch(dialogVisible, (visible) => {
  if (!visible) {
    handleDialogClose();
  }
});

// 监听搜索关键词变化
watch(searchQuery, () => {
  handleSearchInput();
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('chat.searchMessages')"
    width="500px"
    :close-on-click-modal="true"
    class="search-dialog"
    @open="handleDialogOpen"
  >
    <!-- 搜索输入区域 -->
    <div class="search-input-wrapper">
      <el-input
        v-model="searchQuery"
        :placeholder="t('chat.searchPlaceholder')"
        :prefix-icon="Search"
        clearable
        size="large"
        class="search-input"
        @keyup.enter="handleSearch"
      >
        <template #append>
          <el-button :icon="Search" :loading="isLoading" @click="handleSearch">
            {{ t('common.search') }}
          </el-button>
        </template>
      </el-input>
    </div>

    <!-- 搜索结果区域 -->
    <div class="search-results" v-loading="isLoading">
      <!-- 无结果状态 -->
      <div v-if="searchQuery && !isLoading && searchResults.length === 0" class="empty-state">
        <el-empty :description="t('chat.noResults')" :image-size="80" />
      </div>

      <!-- 搜索结果列表 -->
      <div v-else-if="searchResults.length > 0" class="results-list">
        <div class="results-header">
          <span class="results-count">
            {{ t('chat.searchMessages') }} ({{ searchResults.length }})
          </span>
        </div>

        <div
          v-for="message in searchResults"
          :key="message.id"
          class="result-item"
          @click="handleSelectMessage(message)"
        >
          <!-- 消息头部 -->
          <div class="result-header">
            <div class="sender-info">
              <el-icon class="sender-icon"><User /></el-icon>
              <span class="sender-id">{{ message.senderId.slice(0, 8) }}</span>
            </div>
            <div class="time-info">
              <el-icon class="time-icon"><Clock /></el-icon>
              <span class="time-text">{{ formatTime(message.createdAt) }}</span>
            </div>
          </div>

          <!-- 消息内容（高亮显示关键词） -->
          <div class="result-content">
            <el-icon class="message-icon"><ChatDotRound /></el-icon>
            <span
              class="message-text"
              v-html="highlightText(message.content ?? '', searchQuery)"
            ></span>
          </div>

          <!-- 房间名称（如果需要跨房间搜索） -->
          <div v-if="currentRoom" class="room-info">
            <el-tag size="small" type="info">
              {{ currentRoom.room.name ?? t('chat.privateRoom') }}
            </el-tag>
          </div>
        </div>
      </div>

      <!-- 初始状态提示 -->
      <div v-else-if="!searchQuery" class="initial-state">
        <el-icon class="initial-icon" :size="48"><Search /></el-icon>
        <p class="initial-text">{{ t('chat.searchPlaceholder') }}</p>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.search-dialog :deep(.el-dialog__body) {
  padding: 16px 20px;
}

/* 搜索输入区域 */
.search-input-wrapper {
  margin-bottom: 16px;
}

.search-input :deep(.el-input__wrapper) {
  border-radius: 8px;
}

.search-input :deep(.el-input-group__append) {
  border-radius: 0 8px 8px 0;
  padding: 0;
}

.search-input :deep(.el-input-group__append .el-button) {
  margin: 0;
  border-radius: 0 8px 8px 0;
}

/* 搜索结果区域 */
.search-results {
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
}

/* 结果头部 */
.results-header {
  padding: 8px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 8px;
}

.results-count {
  font-size: 13px;
  color: #909399;
  font-weight: 500;
}

/* 结果列表 */
.results-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 单个结果项 */
.result-item {
  padding: 12px 14px;
  background-color: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
}

.result-item:hover {
  background-color: #e6f0ff;
  border-color: #409eff;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.sender-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sender-icon {
  color: #409eff;
  font-size: 14px;
}

.sender-id {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
}

.time-info {
  display: flex;
  align-items: center;
  gap: 4px;
}

.time-icon {
  color: #909399;
  font-size: 12px;
}

.time-text {
  font-size: 11px;
  color: #909399;
}

.result-content {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.message-icon {
  color: #67c23a;
  font-size: 16px;
  flex-shrink: 0;
  margin-top: 2px;
}

.message-text {
  font-size: 14px;
  color: #303133;
  line-height: 1.5;
  word-break: break-word;
}

/* 高亮样式 */
.message-text :deep(.highlight) {
  background-color: #ffc107;
  color: #000;
  padding: 0 2px;
  border-radius: 2px;
}

.room-info {
  display: flex;
  justify-content: flex-end;
}

/* 空状态 */
.empty-state {
  padding: 40px 0;
}

/* 初始状态 */
.initial-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  gap: 12px;
}

.initial-icon {
  color: #c0c4cc;
}

.initial-text {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

/* Element Plus 样式覆盖 */
:deep(.el-empty__description) {
  margin-top: 8px;
}

:deep(.el-dialog) {
  border-radius: 12px;
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 16px;
  margin-right: 0;
}

:deep(.el-dialog__title) {
  font-weight: 600;
  color: #1a1a2e;
}
</style>
