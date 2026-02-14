<template>
  <div class="docs-page">
    <!-- Sidebar -->
    <aside class="docs-sidebar">
      <div class="sidebar-header">
        <span class="sidebar-icon">📚</span>
        <span class="sidebar-title">{{ t('docs.title') }}</span>
      </div>
      <el-menu
        :default-active="route.path"
        class="sidebar-menu"
        router
      >
        <el-menu-item index="/docs">
          <el-icon><Document /></el-icon>
          <span>{{ t('docs.overview') }}</span>
        </el-menu-item>
        <el-menu-item index="/docs/api">
          <el-icon><Connection /></el-icon>
          <span>{{ t('docs.apiReference') }}</span>
        </el-menu-item>
        <el-menu-item index="/docs/oauth">
          <el-icon><Key /></el-icon>
          <span>OAuth 2.0</span>
        </el-menu-item>
        <el-menu-item index="/docs/miniprogram">
          <el-icon><ChatDotRound /></el-icon>
          <span>{{ t('docs.miniprogram') }}</span>
        </el-menu-item>
      </el-menu>
    </aside>

    <!-- Main Content -->
    <main class="docs-content">
      <div class="content-wrapper">
        <!-- Header -->
        <header class="docs-header">
          <div class="header-badge">
            <span class="badge-icon">🔌</span>
            <span class="badge-text">API</span>
          </div>
          <h1 class="docs-title">{{ t('docs.apiReference') }}</h1>
          <p class="docs-description">
            {{ t('docs.apiPageDesc') }}
          </p>
        </header>

        <!-- API Info Cards -->
        <section class="api-info">
          <div class="info-grid">
            <div class="info-card">
              <div class="info-label">{{ t('docs.baseUrl') }}</div>
              <div class="info-value">
                <code>{{ config.public.apiBase }}</code>
                <el-button 
                  size="small" 
                  text 
                  @click="copyBaseUrl"
                >
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
              </div>
            </div>
            <div class="info-card">
              <div class="info-label">{{ t('docs.authMethod') }}</div>
              <div class="info-value">
                <el-tag type="primary" size="small">Bearer Token</el-tag>
              </div>
            </div>
            <div class="info-card">
              <div class="info-label">{{ t('docs.format') }}</div>
              <div class="info-value">
                <el-tag type="success" size="small">JSON</el-tag>
              </div>
            </div>
          </div>
        </section>

        <!-- Swagger UI Container -->
        <section class="swagger-container">
          <div class="swagger-header">
            <h3>{{ t('docs.swaggerTitle') }}</h3>
            <el-button 
              type="primary" 
              :icon="ExternalLink"
              @click="openSwagger"
            >
              {{ t('docs.openSwagger') }}
            </el-button>
          </div>
          
          <div class="swagger-frame-wrapper">
            <iframe 
              ref="swaggerFrame"
              :src="swaggerUrl" 
              class="swagger-frame"
              frameborder="0"
              loading="lazy"
            />
            <div class="frame-loading" v-if="loading">
              <el-icon class="loading-icon" :size="40"><Loading /></el-icon>
              <p>{{ t('common.loading') }}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { Document, Connection, Key, ChatDotRound, CopyDocument, Loading } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

const ExternalLink = defineComponent({
  template: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6v2H5v11h11v-5h2v6a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h6zm11-3v8h-2V6.413l-7.793 7.794-1.414-1.414L17.585 5H13V3h8z"/></svg>`
})

const { t } = useI18n()
const route = useRoute()
const config = useRuntimeConfig()

const swaggerFrame = ref<HTMLIFrameElement | null>(null)
const loading = ref(true)

const swaggerUrl = computed(() => {
  // Use the backend API docs URL
  const baseUrl = config.public.apiBase.replace(/\/api$/, '')
  return `${baseUrl}/api-docs`
})

const copyBaseUrl = async () => {
  try {
    await navigator.clipboard.writeText(config.public.apiBase)
    ElMessage.success(t('common.success'))
  } catch {
    ElMessage.error(t('common.error'))
  }
}

const openSwagger = () => {
  window.open(swaggerUrl.value, '_blank')
}

onMounted(() => {
  if (swaggerFrame.value) {
    swaggerFrame.value.onload = () => {
      loading.value = false
    }
  }
})

// SEO
useHead({
  title: `${t('docs.apiReference')} - 4A User Center`,
  meta: [
    { name: 'description', content: t('docs.apiPageDesc') },
  ],
})
</script>

<style scoped>
.docs-page {
  display: flex;
  min-height: calc(100vh - 160px);
  max-width: 1200px;
  margin: 0 auto;
  gap: 24px;
}

/* Sidebar */
.docs-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  height: fit-content;
  position: sticky;
  top: 88px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 12px;
}

.sidebar-icon {
  font-size: 22px;
}

.sidebar-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.sidebar-menu {
  border: none;
  background: transparent;
}

.sidebar-menu :deep(.el-menu-item) {
  border-radius: 10px;
  margin-bottom: 4px;
  height: 44px;
  line-height: 44px;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  background: rgba(64, 158, 255, 0.08);
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.15) 0%, rgba(103, 194, 58, 0.1) 100%);
  color: #409eff;
  font-weight: 500;
}

/* Main Content */
.docs-content {
  flex: 1;
  min-width: 0;
}

.content-wrapper {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  border-radius: 20px;
  padding: 40px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

/* Header */
.docs-header {
  text-align: center;
  margin-bottom: 32px;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, rgba(103, 194, 58, 0.1) 100%);
  border-radius: 24px;
  margin-bottom: 20px;
  border: 1px solid rgba(64, 158, 255, 0.15);
}

.badge-icon {
  font-size: 14px;
}

.badge-text {
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
}

.docs-title {
  font-size: 32px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 12px;
  letter-spacing: -0.5px;
}

.docs-description {
  font-size: 15px;
  color: #606266;
  max-width: 500px;
  margin: 0 auto;
  line-height: 1.6;
}

/* API Info */
.api-info {
  margin-bottom: 32px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.info-card {
  background: rgba(0, 0, 0, 0.02);
  padding: 20px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.info-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-value code {
  font-family: 'SF Mono', Monaco, 'Andale Mono', monospace;
  font-size: 13px;
  background: rgba(64, 158, 255, 0.1);
  padding: 4px 10px;
  border-radius: 6px;
  color: #409eff;
}

/* Swagger Container */
.swagger-container {
  background: white;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.swagger-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.swagger-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.swagger-frame-wrapper {
  position: relative;
  height: 600px;
}

.swagger-frame {
  width: 100%;
  height: 100%;
  border: none;
}

.frame-loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
}

.loading-icon {
  animation: spin 1s linear infinite;
  color: #409eff;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.frame-loading p {
  margin-top: 16px;
  color: #909399;
}

/* Responsive */
@media (max-width: 1024px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .docs-page {
    flex-direction: column;
  }

  .docs-sidebar {
    width: 100%;
    position: static;
    margin-bottom: 20px;
  }

  .content-wrapper {
    padding: 24px;
  }

  .docs-title {
    font-size: 24px;
  }

  .swagger-header {
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }

  .swagger-frame-wrapper {
    height: 500px;
  }
}
</style>
