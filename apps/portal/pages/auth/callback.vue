<template>
  <div class="callback-page">
    <div class="callback-container">
      <div class="loading-state" v-if="loading">
        <div class="spinner"></div>
        <h2>{{ t('auth.oauth.processing') }}</h2>
        <p>{{ t('auth.oauth.pleaseWait') }}</p>
      </div>

      <div class="error-state" v-else-if="error">
        <div class="error-icon">⚠️</div>
        <h2>{{ t('auth.oauth.failed') }}</h2>
        <p>{{ error }}</p>
        <el-button type="primary" @click="goToLogin">
          {{ t('auth.login.title') }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { handleOAuthCallback } = useAuth()

const loading = ref(true)
const error = ref<string | null>(null)

const goToLogin = () => {
  router.push('/login')
}

onMounted(async () => {
  // Extract tokens from URL query parameters
  const accessToken = route.query.access_token as string
  const refreshToken = route.query.refresh_token as string
  const errorParam = route.query.error as string

  if (errorParam) {
    // OAuth error from backend
    error.value = decodeURIComponent(errorParam)
    loading.value = false
    return
  }

  if (!accessToken) {
    error.value = t('auth.oauth.noToken')
    loading.value = false
    return
  }

  try {
    // Store tokens using auth composable
    handleOAuthCallback(accessToken, refreshToken || '')

    // Small delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500))

    // Redirect to home page
    router.push('/')
  } catch (e: any) {
    error.value = e.message || t('auth.oauth.failed')
    loading.value = false
  }
})
</script>

<style scoped>
.callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  padding: 24px;
}

.callback-container {
  text-align: center;
  padding: 48px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: 24px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
  max-width: 400px;
  width: 100%;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e5e7eb;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 24px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-state h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 8px;
}

.loading-state p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.error-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.error-state h2 {
  font-size: 20px;
  font-weight: 600;
  color: #ef4444;
  margin: 0 0 8px;
}

.error-state p {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 24px;
}

.error-state .el-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
}
</style>
