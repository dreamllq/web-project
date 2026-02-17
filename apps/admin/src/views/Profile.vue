<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { User, Message, Phone, Edit } from '@element-plus/icons-vue';
import { getCurrentUser, updateProfile, requestEmailVerification } from '@/api/user';
import { extractApiError } from '@/api';
import type { UserProfileResponse, UpdateProfileDto } from '@/types/user';

const { t, locale } = useI18n();

const loading = ref(false);
const saving = ref(false);
const verifying = ref(false);
const userProfile = ref<UserProfileResponse | null>(null);

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
</style>
