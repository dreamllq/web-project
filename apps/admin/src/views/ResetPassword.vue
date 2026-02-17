<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Lock, Key } from '@element-plus/icons-vue';
import { resetPassword } from '@/api/user';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

const formRef = ref<FormInstance>();
const loading = ref(false);
const token = ref<string | null>(null);
const hasValidToken = ref(true);

const passwordForm = reactive({
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
  newPassword: [{ required: true, validator: validateNewPassword, trigger: 'blur' }],
  confirmPassword: [{ required: true, validator: validateConfirmPassword, trigger: 'blur' }],
};

onMounted(() => {
  const tokenParam = route.query.token;
  if (!tokenParam || typeof tokenParam !== 'string') {
    hasValidToken.value = false;
  } else {
    token.value = tokenParam;
    hasValidToken.value = true;
  }
});

async function handleSubmit() {
  if (!token.value) {
    ElMessage.error(t('resetPassword.invalidToken'));
    return;
  }

  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;

  try {
    const response = await resetPassword({
      token: token.value,
      newPassword: passwordForm.newPassword,
    });

    if (response.data.success) {
      ElMessage.success(t('resetPassword.success'));
      // Redirect to login page after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } else {
      ElMessage.error(t('resetPassword.failed'));
    }
  } catch {
    ElMessage.error(t('resetPassword.failed'));
  } finally {
    loading.value = false;
  }
}

function goToLogin() {
  router.push('/login');
}
</script>

<template>
  <div class="reset-password-page">
    <div class="reset-password-container">
      <!-- Invalid Token State -->
      <el-card v-if="!hasValidToken" class="reset-password-card error-card">
        <template #header>
          <div class="card-header">
            <el-icon :size="28" class="header-icon"><Key /></el-icon>
            <h2>{{ t('resetPassword.title') }}</h2>
          </div>
        </template>

        <div class="error-content">
          <el-alert
            :title="t('resetPassword.invalidToken')"
            type="error"
            :closable="false"
            show-icon
          />
          <el-button type="primary" class="back-btn" @click="goToLogin">
            {{ t('resetPassword.backToLogin') }}
          </el-button>
        </div>
      </el-card>

      <!-- Valid Token - Show Form -->
      <el-card v-else class="reset-password-card">
        <template #header>
          <div class="card-header">
            <el-icon :size="28" class="header-icon"><Key /></el-icon>
            <h2>{{ t('resetPassword.title') }}</h2>
          </div>
        </template>

        <el-form
          ref="formRef"
          :model="passwordForm"
          :rules="rules"
          label-position="top"
          @submit.prevent="handleSubmit"
        >
          <el-form-item :label="t('resetPassword.newPassword')" prop="newPassword">
            <el-input
              v-model="passwordForm.newPassword"
              type="password"
              :placeholder="t('resetPassword.newPassword')"
              size="large"
              :prefix-icon="Lock"
              show-password
            />
          </el-form-item>

          <el-form-item :label="t('resetPassword.confirmPassword')" prop="confirmPassword">
            <el-input
              v-model="passwordForm.confirmPassword"
              type="password"
              :placeholder="t('resetPassword.confirmPassword')"
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
              {{ t('resetPassword.submit') }}
            </el-button>
          </el-form-item>
        </el-form>

        <div class="login-link">
          <el-link type="primary" :underline="false" @click="goToLogin">
            {{ t('resetPassword.backToLogin') }}
          </el-link>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.reset-password-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 40px 20px;
}

.reset-password-container {
  width: 100%;
  max-width: 440px;
}

.reset-password-card {
  border-radius: 16px;
  border: none;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}

.reset-password-card :deep(.el-card__header) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 28px 32px;
  border-bottom: none;
}

.reset-password-card :deep(.el-card__body) {
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

.login-link {
  text-align: center;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
}

/* Error state styles */
.error-card :deep(.el-card__body) {
  padding: 24px 32px 32px;
}

.error-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
  align-items: center;
}

.back-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 500;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.back-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}
</style>
