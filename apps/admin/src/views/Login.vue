<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { User, Lock, Key, Document } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import api from '@/api';

const { t } = useI18n();
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const loading = ref(false);

const loginForm = reactive({
  username: '',
  password: '',
  rememberMe: false,
});

async function handleLogin() {
  if (!loginForm.username || !loginForm.password) {
    ElMessage.warning(t('login.usernameRequired'));
    return;
  }

  loading.value = true;

  try {
    const response = await api.post('/auth/login', {
      username: loginForm.username,
      password: loginForm.password,
    });

    // Backend returns: { access_token, refresh_token, expires_in, user }
    const { access_token, refresh_token, expires_in, user } = response.data;

    // Store both tokens
    authStore.setTokens({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
    });
    authStore.setUser(user);

    ElMessage.success(t('login.loginSuccess'));

    const redirect = route.query.redirect as string;
    router.push(redirect || '/admin');
  } catch {
    ElMessage.error(t('login.loginFailed'));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-left">
        <div class="brand">
          <h1>4A Admin</h1>
          <p>Account, Authentication, Authorization, Audit</p>
        </div>
        <div class="features">
          <div class="feature">
            <el-icon :size="24"><User /></el-icon>
            <span>Account Management</span>
          </div>
          <div class="feature">
            <el-icon :size="24"><Lock /></el-icon>
            <span>Secure Authentication</span>
          </div>
          <div class="feature">
            <el-icon :size="24"><Key /></el-icon>
            <span>Policy-Based Authorization</span>
          </div>
          <div class="feature">
            <el-icon :size="24"><Document /></el-icon>
            <span>Comprehensive Audit Logs</span>
          </div>
        </div>
      </div>

      <div class="login-right">
        <el-card class="login-card">
          <template #header>
            <div class="card-header">
              <h2>{{ t('login.title') }}</h2>
            </div>
          </template>

          <el-form :model="loginForm" @submit.prevent="handleLogin">
            <el-form-item>
              <el-input
                v-model="loginForm.username"
                :placeholder="t('login.username')"
                size="large"
                :prefix-icon="User"
              />
            </el-form-item>

            <el-form-item>
              <el-input
                v-model="loginForm.password"
                type="password"
                :placeholder="t('login.password')"
                size="large"
                :prefix-icon="Lock"
                show-password
              />
            </el-form-item>

            <el-form-item>
              <div class="form-options">
                <el-checkbox v-model="loginForm.rememberMe">
                  {{ t('login.rememberMe') }}
                </el-checkbox>
                <router-link to="/forgot-password">
                  <el-link type="primary" :underline="false">
                    {{ t('login.forgotPassword') }}
                  </el-link>
                </router-link>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                size="large"
                :loading="loading"
                class="login-btn"
                @click="handleLogin"
              >
                {{ t('login.submit') }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 40px;
}

.login-container {
  display: flex;
  width: 100%;
  max-width: 1000px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
}

.login-left {
  flex: 1;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60px 50px;
  display: flex;
  flex-direction: column;
  justify-content: center;
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
  margin: 0 0 40px 0;
}

.features {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 15px;
}

.feature .el-icon {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-right {
  flex: 1;
  background: #fff;
  padding: 60px 50px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  width: 100%;
  border: none;
  box-shadow: none;
}

.login-card :deep(.el-card__header) {
  padding: 0 0 30px 0;
  border-bottom: none;
}

.login-card :deep(.el-card__body) {
  padding: 0;
}

.card-header h2 {
  font-size: 28px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.login-btn {
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

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

:deep(.el-input__wrapper) {
  border-radius: 10px;
  padding: 4px 15px;
}

:deep(.el-input__inner) {
  height: 48px;
}

@media (max-width: 768px) {
  .login-container {
    flex-direction: column;
  }

  .login-left {
    padding: 40px 30px;
  }

  .login-right {
    padding: 40px 30px;
  }
}
</style>
