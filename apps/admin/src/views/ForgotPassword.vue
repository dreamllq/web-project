<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Message, ArrowLeft } from '@element-plus/icons-vue';
import { forgotPassword } from '@/api/user';
import type { FormInstance, FormRules } from 'element-plus';

const { t } = useI18n();
const router = useRouter();

const loading = ref(false);
const formRef = ref<FormInstance>();

const forgotForm = reactive({
  email: '',
});

const rules: FormRules = {
  email: [
    { required: true, message: t('forgotPassword.emailRequired'), trigger: 'blur' },
    { type: 'email', message: t('forgotPassword.emailInvalid'), trigger: 'blur' },
  ],
};

async function handleSubmit() {
  if (!formRef.value) return;

  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;

  try {
    await forgotPassword({ email: forgotForm.email });
    // Always show generic success message for security
    // (don't reveal if email exists in system)
    ElMessage.success(t('forgotPassword.success'));
  } catch {
    // Still show success message even on error (security best practice)
    ElMessage.success(t('forgotPassword.success'));
  } finally {
    loading.value = false;
  }
}

function goBackToLogin() {
  router.push({ name: 'Login' });
}
</script>

<template>
  <div class="forgot-page">
    <div class="forgot-container">
      <div class="forgot-left">
        <div class="brand">
          <h1>4A Admin</h1>
          <p>Account, Authentication, Authorization, Audit</p>
        </div>
        <div class="illustration">
          <div class="lock-icon">
            <el-icon :size="80"><Message /></el-icon>
          </div>
          <p class="illustration-text">Secure Password Recovery</p>
        </div>
      </div>

      <div class="forgot-right">
        <el-card class="forgot-card">
          <template #header>
            <div class="card-header">
              <h2>{{ t('forgotPassword.title') }}</h2>
              <p class="subtitle">Enter your email to receive reset instructions</p>
            </div>
          </template>

          <el-form ref="formRef" :model="forgotForm" :rules="rules" @submit.prevent="handleSubmit">
            <el-form-item prop="email">
              <el-input
                v-model="forgotForm.email"
                :placeholder="t('forgotPassword.email')"
                size="large"
                :prefix-icon="Message"
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
                {{ t('forgotPassword.submit') }}
              </el-button>
            </el-form-item>

            <el-form-item>
              <el-link type="primary" :underline="false" class="back-link" @click="goBackToLogin">
                <el-icon class="back-icon"><ArrowLeft /></el-icon>
                {{ t('forgotPassword.backToLogin') }}
              </el-link>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.forgot-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 40px;
}

.forgot-container {
  display: flex;
  width: 100%;
  max-width: 1000px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.forgot-left {
  flex: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60px 50px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.brand {
  text-align: center;
  margin-bottom: 60px;
}

.brand h1 {
  font-size: 42px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 12px 0;
  letter-spacing: -1px;
}

.brand p {
  font-size: 16px;
  color: rgba(255, 255, 255, 0.8);
  margin: 0;
}

.illustration {
  text-align: center;
}

.lock-icon {
  width: 140px;
  height: 140px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
  backdrop-filter: blur(10px);
}

.lock-icon .el-icon {
  color: rgba(255, 255, 255, 0.95);
}

.illustration-text {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  font-weight: 500;
}

.forgot-right {
  flex: 1;
  background: #fff;
  padding: 60px 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.forgot-card {
  width: 100%;
  border: none;
  box-shadow: none;
}

.forgot-card :deep(.el-card__header) {
  padding: 0 0 30px 0;
  border-bottom: none;
}

.forgot-card :deep(.el-card__body) {
  padding: 0;
}

.card-header h2 {
  font-size: 28px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 8px 0;
}

.card-header .subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
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
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.back-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
}

.back-icon {
  font-size: 14px;
}

:deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 4px 15px;
}

:deep(.el-input__inner) {
  height: 48px;
}

:deep(.el-form-item) {
  margin-bottom: 24px;
}

:deep(.el-form-item:last-child) {
  margin-bottom: 0;
  text-align: center;
}

@media (max-width: 768px) {
  .forgot-container {
    flex-direction: column;
  }

  .forgot-left {
    padding: 40px 30px;
  }

  .forgot-right {
    padding: 40px 30px;
  }

  .brand {
    margin-bottom: 40px;
  }

  .brand h1 {
    font-size: 32px;
  }

  .lock-icon {
    width: 100px;
    height: 100px;
  }

  .lock-icon .el-icon {
    font-size: 50px;
  }
}
</style>
