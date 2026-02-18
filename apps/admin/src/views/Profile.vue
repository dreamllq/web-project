<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { User, Message, Phone, Edit, Plus } from '@element-plus/icons-vue';
import { getCurrentUser, updateProfile, requestEmailVerification, uploadAvatar } from '@/api/user';
import { extractApiError } from '@/api';
import { getAccessibleUrl } from '@/utils/storage-url';
import type { UserProfileResponse, UpdateProfileDto } from '@/types/user';

const { t, locale } = useI18n();

const loading = ref(false);
const saving = ref(false);
const verifying = ref(false);
const avatarUploading = ref(false);
const previewAvatar = ref<string | null>(null);
const selectedFile = ref<File | null>(null);
const userProfile = ref<UserProfileResponse | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const accessibleAvatarUrl = ref<string | null>(null);

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const form = reactive({
  nickname: '',
  locale: 'zh-CN' as string,
});

const isEmailVerified = computed(() => {
  return !!userProfile.value?.emailVerifiedAt;
});

const languageOptions = [
  { value: 'zh-CN', label: '中文简体' },
  { value: 'en-US', label: 'English' },
];

async function fetchUserProfile() {
  loading.value = true;
  try {
    const response = await getCurrentUser();
    userProfile.value = response.data;
    form.nickname = response.data.nickname || '';
    form.locale = response.data.locale || 'zh-CN';
    // Fetch accessible avatar URL
    accessibleAvatarUrl.value = await getAccessibleUrl(response.data.avatar);
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    const updateData: UpdateProfileDto = {
      locale: form.locale,
    };
    if (form.nickname && form.nickname.trim()) {
      updateData.nickname = form.nickname.trim();
    }
    const response = await updateProfile(updateData);
    userProfile.value = response.data.user;
    // Update i18n locale if changed
    locale.value = form.locale;
    ElMessage.success(t('profile.updateSuccess'));
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    saving.value = false;
  }
}

async function handleRequestVerification() {
  verifying.value = true;
  try {
    await requestEmailVerification();
    ElMessage.success(t('profile.verificationSent'));
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    verifying.value = false;
  }
}

function handleNativeFileChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) {
    return;
  }

  // Validate type
  if (!ALLOWED_TYPES.includes(file.type)) {
    ElMessage.error(t('avatar.invalidFileType'));
    target.value = '';
    return;
  }
  // Validate size
  if (file.size > MAX_SIZE) {
    ElMessage.error(t('avatar.fileTooLarge'));
    target.value = '';
    return;
  }

  selectedFile.value = file;
  previewAvatar.value = URL.createObjectURL(file);
}

function handleRemovePreview() {
  previewAvatar.value = null;
  selectedFile.value = null;
}

async function handleUploadAvatar() {
  if (!selectedFile.value) {
    ElMessage.error(t('avatar.selectFile'));
    return;
  }

  avatarUploading.value = true;
  try {
    const response = await uploadAvatar(selectedFile.value);
    userProfile.value = { ...userProfile.value!, avatar: response.data.avatar };
    // Fetch accessible avatar URL
    accessibleAvatarUrl.value = await getAccessibleUrl(response.data.avatar);
    ElMessage.success(t('avatar.uploadSuccess'));
    handleRemovePreview();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage || t('avatar.uploadFailed'));
  } finally {
    avatarUploading.value = false;
  }
}

onMounted(() => {
  fetchUserProfile();
});
</script>

<template>
  <div class="profile-page">
    <h1 class="page-title">{{ t('profile.title') }}</h1>

    <el-card v-loading="loading" class="profile-card">
      <el-form :model="form" label-position="top" class="profile-form">
        <!-- Username (Read-only) -->
        <el-form-item :label="t('profile.username')">
          <div class="readonly-field">
            <el-icon><User /></el-icon>
            <span>{{ userProfile?.username || '-' }}</span>
          </div>
        </el-form-item>

        <!-- Email (Read-only with verification status) -->
        <el-form-item :label="t('profile.email')">
          <div class="field-with-status">
            <div class="readonly-field">
              <el-icon><Message /></el-icon>
              <span>{{ userProfile?.email || '-' }}</span>
            </div>
            <div class="verification-status">
              <el-tag :type="isEmailVerified ? 'success' : 'warning'" size="small">
                {{ isEmailVerified ? t('profile.emailVerified') : t('profile.emailNotVerified') }}
              </el-tag>
              <el-button
                v-if="!isEmailVerified && userProfile?.email"
                type="primary"
                link
                size="small"
                :loading="verifying"
                @click="handleRequestVerification"
              >
                {{ t('profile.requestVerification') }}
              </el-button>
            </div>
          </div>
        </el-form-item>

        <!-- Phone (Read-only) -->
        <el-form-item :label="t('profile.phone')">
          <div class="readonly-field">
            <el-icon><Phone /></el-icon>
            <span>{{ userProfile?.phone || '-' }}</span>
          </div>
        </el-form-item>

        <!-- Nickname (Editable) -->
        <el-form-item :label="t('profile.nickname')">
          <el-input
            v-model="form.nickname"
            :placeholder="t('profile.nickname')"
            :prefix-icon="Edit"
            clearable
          />
        </el-form-item>

        <!-- Language Preference -->
        <el-form-item :label="t('profile.locale')">
          <el-select v-model="form.locale" class="locale-select">
            <el-option
              v-for="option in languageOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </el-form-item>

        <!-- Save Button -->
        <el-form-item>
          <el-button type="primary" :loading="saving" class="save-btn" @click="handleSave">
            {{ t('profile.save') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- Avatar Upload Section -->
    <el-card class="avatar-card">
      <template #header>
        <div class="card-header">
          <span>{{ t('avatar.upload') }}</span>
        </div>
      </template>

      <div class="avatar-section">
        <!-- Current Avatar -->
        <div class="avatar-current">
          <p class="avatar-label">{{ t('avatar.currentAvatar') }}</p>
          <el-avatar :size="96" :src="accessibleAvatarUrl || undefined" class="user-avatar">
            <el-icon :size="40"><User /></el-icon>
          </el-avatar>
        </div>

        <!-- Divider -->
        <div class="avatar-divider"></div>

        <!-- Upload Area -->
        <div class="avatar-upload">
          <p class="avatar-label">{{ t('avatar.selectFile') }}</p>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style="display: none"
            @change="handleNativeFileChange"
          />
          <el-button @click="() => fileInputRef?.click()">
            <el-icon style="margin-right: 4px"><Plus /></el-icon>
            {{ t('avatar.selectFile') }}
          </el-button>
        </div>
      </div>

      <!-- Preview Section -->
      <div v-if="previewAvatar" class="avatar-preview">
        <div class="preview-container">
          <el-avatar :size="96" :src="previewAvatar" class="preview-avatar" />
          <div class="preview-actions">
            <el-button type="danger" size="small" @click="handleRemovePreview">
              {{ t('avatar.remove') }}
            </el-button>
          </div>
        </div>
        <el-button
          type="primary"
          :loading="avatarUploading"
          class="upload-btn"
          @click="handleUploadAvatar"
        >
          {{ t('avatar.upload') }}
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.profile-page {
  padding: 0;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 24px;
}

.profile-card {
  max-width: 600px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.profile-card :deep(.el-card__body) {
  padding: 32px;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.readonly-field {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: 8px;
  color: #606266;
  font-size: 14px;
}

.readonly-field .el-icon {
  color: #909399;
  font-size: 16px;
}

.field-with-status {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.verification-status {
  display: flex;
  align-items: center;
  gap: 12px;
}

.locale-select {
  width: 100%;
}

.save-btn {
  width: 120px;
  height: 40px;
  font-weight: 500;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.save-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
}

:deep(.el-select .el-input__wrapper) {
  border-radius: 8px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #1a1a2e;
}

/* Avatar Card Styles */
.avatar-card {
  max-width: 600px;
  margin-top: 24px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.avatar-card :deep(.el-card__header) {
  padding: 16px 32px;
  border-bottom: 1px solid #ebeef5;
}

.card-header {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
}

.avatar-card :deep(.el-card__body) {
  padding: 24px 32px;
}

.avatar-section {
  display: flex;
  align-items: center;
  gap: 32px;
}

.avatar-current,
.avatar-upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.avatar-label {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

.user-avatar {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.avatar-divider {
  width: 1px;
  height: 120px;
  background: #ebeef5;
}

.avatar-uploader :deep(.el-upload-dragger) {
  width: 140px;
  height: 100px;
  border-radius: 8px;
  border: 2px dashed #d9d9d9;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s;
}

.avatar-uploader :deep(.el-upload-dragger:hover) {
  border-color: #667eea;
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-icon {
  font-size: 28px;
  color: #c0c4cc;
}

.upload-text {
  font-size: 12px;
  color: #909399;
}

.avatar-preview {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #ebeef5;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-container {
  display: flex;
  align-items: center;
  gap: 16px;
}

.preview-avatar {
  border: 3px solid #667eea;
}

.upload-btn {
  height: 36px;
  padding: 0 24px;
  font-weight: 500;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.upload-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}
</style>
