<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Lock, Key } from '@element-plus/icons-vue';
import { changePassword } from '@/api/user';
import { extractApiError } from '@/api';

const { t } = useI18n();
const router = useRouter();

const formRef = ref<FormInstance>();
const loading = ref(false);

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
});

// Password strength regex: min 8 chars, uppercase, lowercase, and number
const passwordStrengthRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const validateNewPassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error(t('changePassword.newPasswordRequired')));
  } else if (value.length < 8) {
    callback(new Error(t('changePassword.passwordTooShort')));
  } else if (!passwordStrengthRegex.test(value)) {
    callback(new Error(t('changePassword.passwordTooWeak')));
  } else {
    callback();
  }
};

const validateConfirmPassword = (
  _rule: unknown,
  value: string,
  callback: (error?: Error) => void
) => {
  if (!value) {
    callback(new Error(t('changePassword.confirmPasswordRequired')));
  } else if (value !== passwordForm.newPassword) {
    callback(new Error(t('changePassword.passwordMismatch')));
  } else {
    callback();
  }
};

const rules: FormRules = {
  oldPassword: [
    { required: true, message: t('changePassword.oldPasswordRequired'), trigger: 'blur' },
  ],
  newPassword: [{ required: true, validator: validateNewPassword, trigger: 'blur' }],
  confirmPassword: [{ required: true, validator: validateConfirmPassword, trigger: 'blur' }],
};

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;

  try {
    const response = await changePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword,
    });

    if (response.data.success) {
      ElMessage.success(t('changePassword.success'));
      resetForm();
      // Optionally redirect to profile or dashboard
      router.push('/admin/profile');
    } else {
      ElMessage.error(t('changePassword.failed'));
    }
  } catch (error: unknown) {
    // Use extractApiError to get formatted message with code
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

function resetForm() {
  passwordForm.oldPassword = '';
  passwordForm.newPassword = '';
  passwordForm.confirmPassword = '';
  formRef.value?.clearValidate();
}
</script>

<template>
  <div class="change-password-page">
    <div class="change-password-container">
      <el-card class="change-password-card">
        <template #header>
          <div class="card-header">
            <el-icon :size="28" class="header-icon"><Key /></el-icon>
            <h2>{{ t('changePassword.title') }}</h2>
          </div>
        </template>

        <el-form
          ref="formRef"
          :model="passwordForm"
          :rules="rules"
          label-position="top"
          @submit.prevent="handleSubmit"
        >
          <el-form-item :label="t('changePassword.oldPassword')" prop="oldPassword">
            <el-input
              v-model="passwordForm.oldPassword"
              type="password"
              :placeholder="t('changePassword.oldPassword')"
              size="large"
              :prefix-icon="Lock"
              show-password
            />
          </el-form-item>

          <el-form-item :label="t('changePassword.newPassword')" prop="newPassword">
            <el-input
              v-model="passwordForm.newPassword"
              type="password"
              :placeholder="t('changePassword.newPassword')"
              size="large"
              :prefix-icon="Lock"
              show-password
            />
          </el-form-item>

          <el-form-item :label="t('changePassword.confirmPassword')" prop="confirmPassword">
            <el-input
              v-model="passwordForm.confirmPassword"
              type="password"
              :placeholder="t('changePassword.confirmPassword')"
              size="large"
              :prefix-icon="Lock"
              show-password
            />
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              size="large"
              :loading="loading"
              class="submit-btn"
              @click="handleSubmit"
            >
              {{ t('changePassword.submit') }}
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.change-password-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 40px 20px;
}

.change-password-container {
  width: 100%;
  max-width: 440px;
}

.change-password-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.change-password-card :deep(.el-card__header) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 28px 32px;
  border-bottom: none;
}

.change-password-card :deep(.el-card__body) {
  padding: 32px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  color: #fff;
}

.card-header h2 {
  font-size: 22px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #374151;
}

:deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 4px 15px;
  box-shadow: 0 0 0 1px #d1d5db inset;
  transition: all 0.2s;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #667eea inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow:
    0 0 0 2px rgba(102, 126, 234, 0.3) inset,
    0 0 0 1px #667eea inset;
}

:deep(.el-input__inner) {
  height: 44px;
}

.submit-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 500;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  margin-top: 8px;
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.submit-btn:active {
  transform: translateY(0);
}

:deep(.el-form-item) {
  margin-bottom: 22px;
}

:deep(.el-form-item:last-child) {
  margin-bottom: 0;
}
</style>
