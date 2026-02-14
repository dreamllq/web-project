<template>
  <div class="login-page">
    <div class="login-container">
      <!-- Left Side - Branding -->
      <div class="login-branding">
        <div class="branding-content">
          <div class="brand-icon">◈</div>
          <h1 class="brand-title">{{ t('common.appName') }}</h1>
          <p class="brand-subtitle">{{ t('hero.description') }}</p>
          <div class="features-list">
            <div class="feature-item">
              <span class="feature-icon">🔐</span>
              <span>{{ t('features.secure.title') }}</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">⚡</span>
              <span>{{ t('features.fast.title') }}</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🎯</span>
              <span>{{ t('features.abac.title') }}</span>
            </div>
          </div>
        </div>
        <div class="branding-decoration">
          <div class="deco-circle deco-1"></div>
          <div class="deco-circle deco-2"></div>
          <div class="deco-circle deco-3"></div>
        </div>
      </div>

      <!-- Right Side - Form -->
      <div class="login-form-section">
        <el-card class="login-card" shadow="never">
          <template #header>
            <div class="card-header">
              <h2>{{ t('auth.login.title') }}</h2>
              <p>{{ t('auth.login.noAccount') }} <NuxtLink to="/register">{{ t('auth.login.registerNow') }}</NuxtLink></p>
            </div>
          </template>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
            class="login-form"
            @submit.prevent="handleLogin"
          >
            <el-form-item prop="username" :label="t('auth.login.username')">
              <el-input
                v-model="form.username"
                :placeholder="t('auth.login.username')"
                size="large"
                prefix-icon="User"
              />
            </el-form-item>

            <el-form-item prop="password" :label="t('auth.login.password')">
              <el-input
                v-model="form.password"
                type="password"
                :placeholder="t('auth.login.password')"
                size="large"
                prefix-icon="Lock"
                show-password
                @keyup.enter="handleLogin"
              />
            </el-form-item>

            <div class="form-options">
              <el-checkbox v-model="form.rememberMe">{{ t('auth.login.rememberMe') }}</el-checkbox>
              <NuxtLink to="/forgot-password" class="forgot-link">{{ t('auth.login.forgotPassword') }}</NuxtLink>
            </div>

            <el-form-item>
              <el-button
                type="primary"
                size="large"
                class="login-btn"
                :loading="loading"
                @click="handleLogin"
              >
                {{ t('auth.login.submit') }}
              </el-button>
            </el-form-item>

            <el-divider class="divider">
              <span>{{ t('common.or') }}</span>
            </el-divider>

            <div class="oauth-buttons">
              <el-button
                size="large"
                class="wechat-btn"
                :loading="wechatLoading"
                @click="handleWechatLogin"
              >
                <svg class="wechat-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.269-.03-.407-.032zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
                </svg>
                {{ t('auth.oauth.wechatLogin') }}
              </el-button>
            </div>
          </el-form>
        </el-card>

        <p class="back-link">
          <NuxtLink to="/">{{ t('common.back') }} {{ t('nav.home') }}</NuxtLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { login, handleWechatLogin: wechatLogin, isAuthenticated } = useAuth()

// Redirect if already logged in
if (isAuthenticated.value) {
  router.push('/')
}

const formRef = ref<FormInstance>()
const loading = ref(false)
const wechatLoading = ref(false)

const form = reactive({
  username: '',
  password: '',
  rememberMe: false,
})

const rules: FormRules = {
  username: [
    { required: true, message: t('auth.validation.usernameRequired'), trigger: 'blur' },
    { min: 3, message: t('auth.validation.usernameMin'), trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('auth.validation.passwordRequired'), trigger: 'blur' },
    { min: 8, message: t('auth.validation.passwordMin'), trigger: 'blur' },
  ],
}

const handleLogin = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true

  try {
    await login({
      username: form.username,
      password: form.password,
    })

    ElMessage.success(t('auth.login.success'))

    // Redirect to the page user was trying to access, or home
    const redirect = route.query.redirect as string || '/'
    router.push(redirect)
  } catch (error: any) {
    ElMessage.error(error.message || t('auth.login.failed'))
  } finally {
    loading.value = false
  }
}

const handleWechatLogin = async () => {
  wechatLoading.value = true
  try {
    await wechatLogin()
  } catch (error: any) {
    ElMessage.error(error.message || t('auth.oauth.failed'))
    wechatLoading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 24px;
}

.login-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  max-width: 1000px;
  width: 100%;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
}

/* Branding Section */
.login-branding {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.branding-content {
  position: relative;
  z-index: 1;
  color: white;
}

.brand-icon {
  font-size: 56px;
  margin-bottom: 16px;
  text-shadow: 0 4px 20px rgba(255, 255, 255, 0.3);
}

.brand-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 12px;
  letter-spacing: -0.5px;
}

.brand-subtitle {
  font-size: 14px;
  opacity: 0.9;
  line-height: 1.6;
  margin: 0 0 32px;
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 500;
}

.feature-icon {
  font-size: 20px;
}

/* Decorative Circles */
.branding-decoration {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.deco-circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.deco-1 {
  width: 300px;
  height: 300px;
  top: -100px;
  right: -100px;
}

.deco-2 {
  width: 200px;
  height: 200px;
  bottom: -50px;
  left: -50px;
}

.deco-3 {
  width: 100px;
  height: 100px;
  bottom: 30%;
  right: 20%;
}

/* Form Section */
.login-form-section {
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.login-card {
  border: none;
  background: transparent;
}

.login-card :deep(.el-card__header) {
  padding: 0 0 24px;
  border-bottom: none;
}

.login-card :deep(.el-card__body) {
  padding: 0;
}

.card-header h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 8px;
}

.card-header p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.card-header a {
  color: #667eea;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s;
}

.card-header a:hover {
  color: #764ba2;
}

.login-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #374151;
}

.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.forgot-link {
  font-size: 13px;
  color: #667eea;
  text-decoration: none;
  transition: color 0.2s;
}

.forgot-link:hover {
  color: #764ba2;
}

.login-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

.divider {
  margin: 24px 0;
}

.divider :deep(.el-divider__text) {
  color: #9ca3af;
  font-size: 12px;
  padding: 0 16px;
}

.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wechat-btn {
  width: 100%;
  height: 48px;
  font-size: 15px;
  font-weight: 500;
  background: #07c160;
  border: none;
  color: white;
  border-radius: 12px;
  transition: background 0.2s, transform 0.2s;
}

.wechat-btn:hover {
  background: #06ad56;
  transform: translateY(-2px);
}

.wechat-icon {
  width: 20px;
  height: 20px;
  margin-right: 8px;
}

.back-link {
  text-align: center;
  margin-top: 24px;
}

.back-link a {
  color: #6b7280;
  text-decoration: none;
  font-size: 14px;
  transition: color 0.2s;
}

.back-link a:hover {
  color: #667eea;
}

/* Responsive */
@media (max-width: 768px) {
  .login-container {
    grid-template-columns: 1fr;
  }

  .login-branding {
    padding: 32px;
    display: none;
  }

  .login-form-section {
    padding: 32px 24px;
  }
}
</style>
