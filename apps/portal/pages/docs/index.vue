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
            <span class="badge-icon">✨</span>
            <span class="badge-text">{{ t('common.appName') }}</span>
          </div>
          <h1 class="docs-title">{{ t('docs.welcome') }}</h1>
          <p class="docs-description">
            {{ t('docs.description') }}
          </p>
        </header>

        <!-- Quick Links Grid -->
        <section class="quick-links">
          <h2 class="section-title">{{ t('docs.quickStart') }}</h2>
          <div class="links-grid">
            <NuxtLink to="/docs/api" class="link-card api-card">
              <div class="card-icon">
                <span>🔌</span>
              </div>
              <div class="card-content">
                <h3>{{ t('docs.apiReference') }}</h3>
                <p>{{ t('docs.apiDesc') }}</p>
              </div>
              <div class="card-arrow">
                <el-icon><ArrowRight /></el-icon>
              </div>
            </NuxtLink>

            <NuxtLink to="/docs/oauth" class="link-card oauth-card">
              <div class="card-icon">
                <span>🔐</span>
              </div>
              <div class="card-content">
                <h3>OAuth 2.0</h3>
                <p>{{ t('docs.oauthDesc') }}</p>
              </div>
              <div class="card-arrow">
                <el-icon><ArrowRight /></el-icon>
              </div>
            </NuxtLink>

            <NuxtLink to="/docs/miniprogram" class="link-card mini-card">
              <div class="card-icon">
                <span>📱</span>
              </div>
              <div class="card-content">
                <h3>{{ t('docs.miniprogram') }}</h3>
                <p>{{ t('docs.miniprogramDesc') }}</p>
              </div>
              <div class="card-arrow">
                <el-icon><ArrowRight /></el-icon>
              </div>
            </NuxtLink>
          </div>
        </section>

        <!-- Features Overview -->
        <section class="features-overview">
          <h2 class="section-title">{{ t('docs.features') }}</h2>
          <div class="features-grid">
            <div class="feature-item">
              <div class="feature-icon">🚀</div>
              <h4>{{ t('docs.featureFast') }}</h4>
              <p>{{ t('docs.featureFastDesc') }}</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🔒</div>
              <h4>{{ t('docs.featureSecure') }}</h4>
              <p>{{ t('docs.featureSecureDesc') }}</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">🔄</div>
              <h4>{{ t('docs.featureMulti') }}</h4>
              <p>{{ t('docs.featureMultiDesc') }}</p>
            </div>
            <div class="feature-item">
              <div class="feature-icon">📊</div>
              <h4>{{ t('docs.featureAbac') }}</h4>
              <p>{{ t('docs.featureAbacDesc') }}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { Document, Connection, Key, ChatDotRound, ArrowRight } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()

// SEO
useHead({
  title: `${t('docs.title')} - 4A User Center`,
  meta: [
    { name: 'description', content: t('docs.description') },
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
  margin-bottom: 48px;
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
  font-size: 36px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 16px;
  letter-spacing: -0.5px;
}

.docs-description {
  font-size: 16px;
  color: #606266;
  max-width: 600px;
  margin: 0 auto;
  line-height: 1.6;
}

/* Section Title */
.section-title {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 24px;
}

/* Quick Links */
.quick-links {
  margin-bottom: 48px;
}

.links-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.link-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 24px;
  background: white;
  border-radius: 16px;
  text-decoration: none;
  border: 1px solid rgba(0, 0, 0, 0.05);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.link-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--card-color-start), var(--card-color-end));
  opacity: 0;
  transition: opacity 0.3s ease;
}

.link-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.1);
}

.link-card:hover::before {
  opacity: 1;
}

.api-card {
  --card-color-start: #409eff;
  --card-color-end: #67c23a;
}

.oauth-card {
  --card-color-start: #e6a23c;
  --card-color-end: #f56c6c;
}

.mini-card {
  --card-color-start: #909399;
  --card-color-end: #409eff;
}

.card-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%);
  border-radius: 12px;
  flex-shrink: 0;
}

.card-content {
  flex: 1;
}

.card-content h3 {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 6px;
}

.card-content p {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

.card-arrow {
  color: #c0c4cc;
  transition: all 0.3s ease;
}

.link-card:hover .card-arrow {
  color: #409eff;
  transform: translateX(4px);
}

/* Features Overview */
.features-overview {
  padding-top: 32px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.feature-item {
  text-align: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.feature-item:hover {
  background: rgba(64, 158, 255, 0.05);
}

.feature-icon {
  font-size: 32px;
  margin-bottom: 12px;
}

.feature-item h4 {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px;
}

.feature-item p {
  font-size: 12px;
  color: #909399;
  margin: 0;
  line-height: 1.5;
}

/* Responsive */
@media (max-width: 1024px) {
  .links-grid {
    grid-template-columns: 1fr;
  }

  .features-grid {
    grid-template-columns: repeat(2, 1fr);
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
    font-size: 28px;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }
}
</style>
