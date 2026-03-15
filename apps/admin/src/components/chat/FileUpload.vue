<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { Document, UploadFilled } from '@element-plus/icons-vue';
import type { UploadFile, UploadRawFile, UploadInstance } from 'element-plus';
import { uploadFile, type FileUploadResponse } from '@/api/chat';
import { extractApiError } from '@/api';
import { useChatStore } from '@/stores/chat';

// ============================================
// Props & Emits
// ============================================
const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'success', fileUrl: string): void;
}>();

// ============================================
// Composables
// ============================================
const { t } = useI18n();
const chatStore = useChatStore();

// ============================================
// Constants
// ============================================

// 允许的文件类型
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// 文件扩展名映射
const ACCEPT_EXTENSIONS = '.jpg,.jpeg,.png,.gif,.pdf,.doc,.docx';

// 最大文件大小: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ============================================
// State
// ============================================
const uploadRef = ref<UploadInstance>();
const isUploading = ref(false);
const uploadProgress = ref(0);
const selectedFile = ref<UploadFile | null>(null);
const previewUrl = ref<string | null>(null);

// ============================================
// Computed
// ============================================

// 对话框可见性
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

// 是否是图片文件
const isImageFile = computed(() => {
  if (!selectedFile.value?.raw) return false;
  const type = selectedFile.value.raw.type;
  return type.startsWith('image/');
});

// 是否有选中的文件
const hasSelectedFile = computed(() => selectedFile.value !== null);

// 是否禁用上传按钮
const isUploadDisabled = computed(() => {
  return !hasSelectedFile.value || isUploading.value || !chatStore.currentRoomId;
});

// ============================================
// Helper Functions
// ============================================

/**
 * 检查文件类型是否允许
 */
function isFileTypeAllowed(file: File): boolean {
  return ALLOWED_TYPES.includes(file.type);
}

/**
 * 检查文件大小是否超过限制
 */
function isFileSizeValid(file: File): boolean {
  return file.size <= MAX_FILE_SIZE;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============================================
// Event Handlers
// ============================================

/**
 * 文件选择变化时的处理
 */
function handleFileChange(file: UploadFile, fileList: UploadFile[]): void {
  // 只保留最新的文件
  if (fileList.length > 1) {
    fileList.splice(0, fileList.length - 1);
  }

  selectedFile.value = file;

  // 清除之前的预览
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }

  // 生成图片预览
  if (file.raw && file.raw.type.startsWith('image/')) {
    previewUrl.value = URL.createObjectURL(file.raw);
  }
}

/**
 * 上传前的验证
 */
function handleBeforeUpload(file: UploadRawFile): boolean {
  // 验证文件类型
  if (!isFileTypeAllowed(file)) {
    ElMessage.error(t('chat.invalidFileType'));
    return false;
  }

  // 验证文件大小
  if (!isFileSizeValid(file)) {
    ElMessage.error(t('chat.fileTooLarge', { max: '10MB' }));
    return false;
  }

  return true;
}

/**
 * 执行文件上传
 */
async function handleUpload(): Promise<void> {
  if (!selectedFile.value?.raw || !chatStore.currentRoomId) {
    return;
  }

  isUploading.value = true;
  uploadProgress.value = 0;

  try {
    // 模拟上传进度
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 10;
      }
    }, 100);

    const response = await uploadFile(selectedFile.value.raw, chatStore.currentRoomId);

    clearInterval(progressInterval);
    uploadProgress.value = 100;

    const data: FileUploadResponse = response.data;

    // 发送成功事件
    emit('success', data.url);

    // 显示成功消息
    ElMessage.success(t('chat.uploadSuccess'));

    // 关闭对话框
    handleClose();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    isUploading.value = false;
    uploadProgress.value = 0;
  }
}

/**
 * 移除选中的文件
 */
function handleRemoveFile(): void {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }
  selectedFile.value = null;
  uploadRef.value?.clearFiles();
}

/**
 * 关闭对话框
 */
function handleClose(): void {
  handleRemoveFile();
  dialogVisible.value = false;
}

// ============================================
// Watchers
// ============================================

// 对话框关闭时清理状态
watch(dialogVisible, (visible) => {
  if (!visible) {
    handleRemoveFile();
    uploadProgress.value = 0;
    isUploading.value = false;
  }
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('chat.uploadFile')"
    width="500px"
    :close-on-click-modal="!isUploading"
    :close-on-press-escape="!isUploading"
    :show-close="!isUploading"
    @close="handleClose"
  >
    <!-- 上传区域 -->
    <div v-if="!hasSelectedFile" class="upload-area">
      <el-upload
        ref="uploadRef"
        drag
        :auto-upload="false"
        :accept="ACCEPT_EXTENSIONS"
        :show-file-list="false"
        :before-upload="handleBeforeUpload"
        :on-change="handleFileChange"
        class="upload-dragger"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">
          {{ t('chat.dragFileHere') }}
        </div>
        <div class="upload-hint">
          {{ t('chat.supportedFormats') }}: jpg, png, gif, pdf, doc, docx
        </div>
        <div class="upload-hint">{{ t('chat.maxFileSize') }}: 10MB</div>
      </el-upload>
    </div>

    <!-- 文件预览区域 -->
    <div v-else class="file-preview">
      <!-- 图片预览 -->
      <div v-if="isImageFile && previewUrl" class="image-preview">
        <img :src="previewUrl" alt="preview" class="preview-image" />
      </div>

      <!-- 文件图标预览 -->
      <div v-else class="document-preview">
        <el-icon :size="64" color="#909399">
          <Document />
        </el-icon>
      </div>

      <!-- 文件信息 -->
      <div class="file-info">
        <div class="file-name">{{ selectedFile?.name }}</div>
        <div class="file-size">{{ formatFileSize(selectedFile?.size || 0) }}</div>
      </div>

      <!-- 移除文件按钮 -->
      <el-button
        v-if="!isUploading"
        type="danger"
        text
        class="remove-btn"
        @click="handleRemoveFile"
      >
        {{ t('common.remove') }}
      </el-button>
    </div>

    <!-- 上传进度 -->
    <div v-if="isUploading" class="upload-progress">
      <el-progress :percentage="uploadProgress" :stroke-width="8" />
    </div>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="dialog-footer">
        <el-button :disabled="isUploading" @click="handleClose">
          {{ t('common.cancel') }}
        </el-button>
        <el-button
          type="primary"
          :disabled="isUploadDisabled"
          :loading="isUploading"
          @click="handleUpload"
        >
          {{ isUploading ? t('chat.uploading') : t('chat.upload') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 上传区域样式 */
.upload-area {
  padding: 20px 0;
}

.upload-dragger {
  width: 100%;
}

.upload-dragger :deep(.el-upload-dragger) {
  width: 100%;
  height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  background-color: #fafafa;
  transition: all 0.3s;
}

.upload-dragger :deep(.el-upload-dragger:hover) {
  border-color: #409eff;
}

.upload-icon {
  font-size: 48px;
  color: #c0c4cc;
  margin-bottom: 16px;
}

.upload-text {
  font-size: 16px;
  color: #606266;
  margin-bottom: 8px;
}

.upload-hint {
  font-size: 12px;
  color: #909399;
}

/* 文件预览样式 */
.file-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.image-preview {
  width: 100%;
  max-height: 200px;
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  overflow: hidden;
  border-radius: 4px;
}

.preview-image {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
}

.document-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100px;
  height: 100px;
  background-color: #fff;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid #ebeef5;
}

.file-info {
  text-align: center;
  margin-bottom: 12px;
}

.file-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 4px;
  word-break: break-all;
}

.file-size {
  font-size: 12px;
  color: #909399;
}

.remove-btn {
  margin-top: 8px;
}

/* 上传进度样式 */
.upload-progress {
  padding: 16px 0;
}

/* 底部按钮样式 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
