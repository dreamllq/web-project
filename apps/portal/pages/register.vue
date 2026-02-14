<template>
  <div class="register-page">
    <div class="register-container">
      <!-- Left Side - Form -->
      <div class="register-form-section">
        <el-card class="register-card" shadow="never">
          <template #header>
            <div class="card-header">
              <h2>{{ t('auth.register.title') }}</h2>
              <p>{{ t('auth.register.hasAccount') }} <NuxtLink to="/login">{{ t('auth.register.loginNow') }}</NuxtLink></p>
            </div>
          </template>

          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
            class="register-form"
            @submit.prevent="handleRegister"
          >
            <el-form-item prop="username" :label="t('auth.register.username')">
              <el-input
                v-model="form.username"
                :placeholder="t('auth.register.username')"
                size="large"
                prefix-icon="User"
              />
            </el-form-item>

            <el-form-item prop="email" :label="t('auth.register.email')">
              <el-input
                v-model="form.email"
                :placeholder="t('auth.register.email')"
                size="large"
                prefix-icon="Message"
              />
            </el-form-item>

            <el-form-item prop="phone" :label="t('auth.register.phone')">
              <el-input
                v-model="form.phone"
                :placeholder="t('auth.register.phone')"
                size="large"
                prefix-icon="Phone"
              />
            </el-form-item>

            <div class="password-row">
              <el-form-item prop="password" :label="t('auth.register.password')">
                <el-input
                  v-model="form.password"
                  type="password"
                  :placeholder="t('auth.register.password')"
                  size="large"
                  prefix-icon="Lock"
                  show-password
                />
              </el-form-item>

              <el-form-item prop="confirmPassword" :label="t('auth.register.confirmPassword')">
                <el-input
                  v-model="form.confirmPassword"
                  type="password"
                  :placeholder="t('auth.register.confirmPassword')"
                  size="large"
                  prefix-icon="Lock"
                  show-password
                  @keyup.enter="handleRegister"
                />
              </el-form-item>
            </div>

            <el-form-item>
              <el-button
                type="primary"
                size="large"
                class="register-btn"
                :loading="loading"
                @click="handleRegister"
              >
                {{ t('auth.register.submit') }}
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

      <!-- Right Side - Branding -->
      <div class="register-branding">
        <div class="branding-content">
          <div class="brand-icon">◈</div>
          <h1 class="brand-title">{{ t('common.appName') }}</h1>
          <p class="brand-subtitle">{{ t('cta.description') }}</p>
          <div class="features-list">
            <div class="feature-item">
              <span class="feature-icon">✨</span>
              <span>{{ t('hero.title') }}</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🔗</span>
              <span>{{ t('features.oauth.title') }}</span>
            </div>
            <div class="feature-item">
              <span class="feature-icon">🛡️</span>
              <span>{{ t('features.secure.description') }}</span>
            </div>
          </div>
        </div>
        <div class="branding-decoration">
          <div class="deco-circle deco-1"></div>
          <div class="deco-circle deco-2"></div>
          <div class="deco-circle deco-3"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'

const { t } = useI18n()
const router = useRouter()
const { register: registerUser, handleWechatLogin: wechatLogin, isAuthenticated } = useAuth()

// Redirect if already logged in
if (isAuthenticated.value) {
  router.push('/')
}

const formRef = ref<FormInstance>()
const loading = ref(false)
const wechatLoading = ref(false)

const form = reactive({
  username: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
})

// Custom validator for password match
const validatePasswordMatch = (_rule: any, value: string, callback: (error?: Error) => void) => {
  if (value !== form.password) {
    callback(new Error(t('auth.validation.passwordMatch')))
  } else {
    callback()
  }
}

// Custom validator for email
const validateEmail = (_rule: any, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback() // Email is optional
    return
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(value)) {
    callback(new Error(t('auth.validation.emailInvalid')))
  } else {
    callback()
  }
}

// Custom validator for phone
const validatePhone = (_rule: any, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback() // Phone is optional
    return
  }
  const phoneRegex = /^1[3-9]\d{9}$/
  if (!phoneRegex.test(value)) {
    callback(new Error(t('auth.validation.phoneInvalid')))
  } else {
    callback()
  }
}

const rules: FormRules = {
  username: [
    { required: true, message: t('auth.validation.usernameRequired'), trigger: 'blur' },
    { min: 3, message: t('auth.validation.usernameMin'), trigger: 'blur' },
  ],
  email: [
    { validator: validateEmail, trigger: 'blur' },
  ],
  phone: [
    { validator: validatePhone, trigger: 'blur' },
  ],
  password: [
    { required: true, message: t('auth.validation.passwordRequired'), trigger: 'blur' },
    { min: 8, message: t('auth.validation.passwordMin'), trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: t('auth.validation.passwordRequired'), trigger: 'blur' },
    { validator: validatePasswordMatch, trigger: 'blur' },
  ],
}

const handleRegister = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
  } catch {
    return
  }

  loading.value = true

  try {
    await registerUser({
      username: form.username,
      email: form.email || undefined,
      phone: form.phone || undefined,
      password: form.password,
    })

    ElMessage.success(t('auth.register.success'))
    router.push('/login')
  } catch (error: any) {
    ElMessage.error(error.message || t('auth.register.failed'))
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
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f3460 0%, #16213e 50%, #1a1a2e 100%);
  padding: 24px;
}

.register-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  max-width: 1000px;
  width: 100%;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24px;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
}

/* Form Section */
.register-form-section {
  padding: 48px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.register-card {
  border: none;
  background: transparent;
}

.register-card :deep(.el-card__header) {
  padding: 0 0 24px;
  border-bottom: none;
}

.register-card :deep(.el-card__body) {
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
  color: #10b981;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.2s;
}

.card-header a:hover {
  color: #059669;
}

.register-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #374151;
}

.password-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.register-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  border-radius: 12px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.register-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
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
  color: #10b981;
}

/* Branding Section */
.register-branding {
  background: linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%);
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
  left: -100px;
}

.deco-2 {
  width: 200px;
  height: 200px;
  bottom: -50px;
  right: -50px;
}

.deco-3 {
  width: 100px;
  height: 100px;
  top: 40%;
  left: 20%;
}

/* Responsive */
@media (max-width: 768px) {
  .register-container {
    grid-template-columns: 1fr;
  }

  .register-branding {
    padding: 32px;
    display: none;
  }

  .register-form-section {
    padding: 32px 24px;
  }

  .password-row {
    grid-template-columns: 1fr;
  }
}
</style>
