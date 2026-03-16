<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, type FormInstance, type FormRules, type UploadProps } from 'element-plus';
import { Plus, User, ChatDotSquare, Delete } from '@element-plus/icons-vue';
import { createRoom, createPrivateRoom, uploadFile } from '@/api/chat';
import { extractApiError } from '@/api';
import MemberSelector from './MemberSelector.vue';
import type { RoomType, Room } from '@/types/chat';

// ============================================
// Props & Emits
// ============================================

interface Props {
  /** 对话框可见性 */
  modelValue: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  /** 聊天室创建成功时触发 */
  (e: 'success', room: Room): void;
}>();

// ============================================
// Composables
// ============================================

const { t } = useI18n();

// ============================================
// Types
// ============================================

/** 房间类型选项 */
type RoomTypeOption = 'private' | 'group';

// ============================================
// State
// ============================================

/** 表单引用 */
const formRef = ref<FormInstance>();
/** 提交加载状态 */
const submitting = ref(false);
/** 头像上传加载状态 */
const avatarUploading = ref(false);

/** 表单数据 */
const formData = ref({
  /** 房间类型 */
  type: 'private' as RoomTypeOption,
  /** 群聊名称 */
  name: '',
  /** 群聊头像 URL */
  avatar: '',
  /** 成员 ID 列表 */
  memberIds: [] as string[],
});

/** 头像预览 URL */
const avatarPreviewUrl = ref('');

// ============================================
// Computed
// ============================================

/** 对话框可见性双向绑定 */
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

/** 是否为群聊模式 */
const isGroupMode = computed(() => formData.value.type === 'group');

/** 表单验证规则 */
const formRules = computed<FormRules>(() => ({
  type: [{ required: true, message: t('chat.selectRoomType'), trigger: 'change' }],
  // 群聊名称必填
  ...(isGroupMode.value && {
    name: [
      { required: true, message: t('chat.roomNameRequired'), trigger: 'blur' },
      { min: 1, max: 100, message: t('chat.roomNameLength'), trigger: 'blur' },
    ],
  }),
  // 私聊必须选择一个成员
  ...(!isGroupMode.value && {
    memberIds: [
      {
        validator: (_rule, value, callback) => {
          if (!value || value.length !== 1) {
            callback(new Error(t('chat.selectOneMember')));
          } else {
            callback();
          }
        },
        trigger: 'change',
      },
    ],
  }),
}));

/** 提交按钮文本 */
const submitButtonText = computed(() => {
  return isGroupMode.value ? t('chat.createGroup') : t('chat.createPrivateRoom');
});

/** 成员选择器最大可选人数 */
const memberMaxCount = computed(() => (isGroupMode.value ? undefined : 1));

// ============================================
// Methods
// ============================================

/**
 * 重置表单
 */
function resetForm(): void {
  formData.value = {
    type: 'private',
    name: '',
    avatar: '',
    memberIds: [],
  };
  avatarPreviewUrl.value = '';
  formRef.value?.resetFields();
}

/**
 * 对话框打开时的处理
 */
function handleDialogOpen(): void {
  resetForm();
}

/**
 * 处理房间类型变化
 */
function handleTypeChange(): void {
  // 切换类型时清空成员选择
  formData.value.memberIds = [];
  // 清空群聊名称和头像
  if (formData.value.type === 'private') {
    formData.value.name = '';
    formData.value.avatar = '';
    avatarPreviewUrl.value = '';
  }
}

/**
 * 处理头像上传前的校验
 */
const beforeAvatarUpload: UploadProps['beforeUpload'] = (rawFile) => {
  // 检查文件类型
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(rawFile.type);
  if (!isImage) {
    ElMessage.error(t('avatar.invalidFileType'));
    return false;
  }
  // 检查文件大小 (2MB)
  const isLt2M = rawFile.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    ElMessage.error(t('avatar.fileTooLarge'));
    return false;
  }
  return true;
};

/**
 * 处理头像上传
 */
const handleAvatarUpload: UploadProps['httpRequest'] = async (options) => {
  const file = options.file as File;
  avatarUploading.value = true;

  try {
    // 先创建临时预览
    avatarPreviewUrl.value = URL.createObjectURL(file);

    // 上传文件到服务器（需要临时 roomId，使用空字符串）
    const response = await uploadFile(file, '');
    formData.value.avatar = response.data.url;
    ElMessage.success(t('avatar.uploadSuccess'));
  } catch (error: unknown) {
    // 上传失败，清除预览
    avatarPreviewUrl.value = '';
    formData.value.avatar = '';
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    avatarUploading.value = false;
  }
};

/**
 * 移除头像
 */
function handleRemoveAvatar(): void {
  avatarPreviewUrl.value = '';
  formData.value.avatar = '';
}

/**
 * 提交表单
 */
async function handleSubmit(): Promise<void> {
  if (!formRef.value) return;

  try {
    // 验证表单
    await formRef.value.validate();
  } catch {
    // 验证失败
    return;
  }

  submitting.value = true;

  try {
    // 构建请求数据
    const createData: { type: RoomType; name?: string; avatar?: string; memberIds?: string[] } = {
      type: formData.value.type,
    };

    if (isGroupMode.value) {
      // 群聊模式
      createData.name = formData.value.name.trim();
      if (formData.value.avatar) {
        createData.avatar = formData.value.avatar;
      }
      if (formData.value.memberIds.length > 0) {
        createData.memberIds = formData.value.memberIds;
      }

      // 调用 API 创建群聊房间
      const response = await createRoom(createData);
      const room = response.data;
      ElMessage.success(t('chat.createRoomSuccess'));
      emit('success', room);
    } else {
      // 私聊模式 - 使用专用接口
      const response = await createPrivateRoom({
        targetUserId: formData.value.memberIds[0],
      });
      // 私聊接口返回 roomId，需要构造 room 对象
      const room = { id: response.data.roomId } as Room;
      ElMessage.success(t('chat.createRoomSuccess'));
      emit('success', room);
    }

    dialogVisible.value = false;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    submitting.value = false;
  }
}

/**
 * 取消操作
 */
function handleCancel(): void {
  dialogVisible.value = false;
}

// ============================================
// Watchers
// ============================================

// 监听对话框关闭，重置状态
watch(dialogVisible, (visible) => {
  if (!visible) {
    // 清理预览 URL
    if (avatarPreviewUrl.value) {
      URL.revokeObjectURL(avatarPreviewUrl.value);
    }
  }
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('chat.createRoom')"
    width="500px"
    :close-on-click-modal="!submitting"
    :close-on-press-escape="!submitting"
    class="create-room-dialog"
    @open="handleDialogOpen"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-position="top"
      class="create-room-form"
    >
      <!-- 房间类型选择 -->
      <el-form-item :label="t('chat.roomType')" prop="type">
        <el-radio-group
          v-model="formData.type"
          :disabled="submitting"
          class="room-type-radio"
          @change="handleTypeChange"
        >
          <el-radio-button value="private">
            <div class="radio-content">
              <el-icon><User /></el-icon>
              <span>{{ t('chat.privateRoom') }}</span>
            </div>
          </el-radio-button>
          <el-radio-button value="group">
            <div class="radio-content">
              <el-icon><ChatDotSquare /></el-icon>
              <span>{{ t('chat.groupRoom') }}</span>
            </div>
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <!-- 群聊名称（仅群聊模式显示） -->
      <el-form-item v-if="isGroupMode" :label="t('chat.roomName')" prop="name">
        <el-input
          v-model="formData.name"
          :placeholder="t('chat.roomNamePlaceholder')"
          :disabled="submitting"
          maxlength="100"
          show-word-limit
          clearable
        />
      </el-form-item>

      <!-- 群聊头像（仅群聊模式显示） -->
      <el-form-item v-if="isGroupMode" :label="t('chat.groupAvatar')" prop="avatar">
        <div class="avatar-upload-wrapper">
          <!-- 头像预览 -->
          <div v-if="avatarPreviewUrl || formData.avatar" class="avatar-preview">
            <img :src="avatarPreviewUrl || formData.avatar" alt="avatar" class="avatar-image" />
            <div class="avatar-actions">
              <el-button
                type="danger"
                :icon="Delete"
                circle
                size="small"
                @click="handleRemoveAvatar"
              />
            </div>
          </div>
          <!-- 上传按钮 -->
          <el-upload
            v-else
            class="avatar-uploader"
            :show-file-list="false"
            :before-upload="beforeAvatarUpload"
            :http-request="handleAvatarUpload"
          >
            <div class="upload-trigger" :class="{ 'is-loading': avatarUploading }">
              <el-icon v-if="!avatarUploading" class="upload-icon"><Plus /></el-icon>
              <el-icon v-else class="is-loading"><Plus /></el-icon>
              <span class="upload-text">{{
                avatarUploading ? t('chat.uploading') : t('chat.uploadAvatar')
              }}</span>
            </div>
          </el-upload>
        </div>
      </el-form-item>

      <!-- 成员选择 -->
      <el-form-item
        :label="isGroupMode ? t('chat.selectMembers') : t('chat.selectUser')"
        prop="memberIds"
      >
        <MemberSelector
          v-model="formData.memberIds"
          :placeholder="
            isGroupMode ? t('chat.selectMembersPlaceholder') : t('chat.selectUserPlaceholder')
          "
          :disabled="submitting"
          :max="memberMaxCount"
        />
      </el-form-item>
    </el-form>

    <!-- 底部按钮 -->
    <template #footer>
      <div class="dialog-footer">
        <el-button :disabled="submitting" @click="handleCancel">
          {{ t('common.cancel') }}
        </el-button>
        <el-button type="primary" :loading="submitting" @click="handleSubmit">
          {{ submitButtonText }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.create-room-dialog :deep(.el-dialog__body) {
  padding: 20px 24px;
}

.create-room-form {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 房间类型单选按钮 */
.room-type-radio {
  width: 100%;
}

.room-type-radio :deep(.el-radio-button) {
  flex: 1;
}

.room-type-radio :deep(.el-radio-button__inner) {
  width: 100%;
  padding: 12px 16px;
}

.radio-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* 头像上传区域 */
.avatar-upload-wrapper {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.avatar-preview {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #dcdfe6;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-actions {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.avatar-preview:hover .avatar-actions {
  opacity: 1;
}

.avatar-uploader {
  width: 100px;
  height: 100px;
}

.upload-trigger {
  width: 100px;
  height: 100px;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
  background-color: #fafafa;
}

.upload-trigger:hover {
  border-color: #409eff;
}

.upload-trigger.is-loading {
  cursor: not-allowed;
  opacity: 0.6;
}

.upload-icon {
  font-size: 24px;
  color: #8c939d;
}

.upload-text {
  font-size: 12px;
  color: #8c939d;
}

/* 底部按钮 */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Element Plus 样式覆盖 */
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

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #606266;
}

:deep(.el-radio-button__inner) {
  border-radius: 8px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-radius: 8px 0 0 8px;
}

:deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 0 8px 8px 0;
}
</style>
