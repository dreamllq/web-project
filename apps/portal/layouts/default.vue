<template>
  <el-container class="default-layout">
    <!-- Header -->
    <el-header class="layout-header">
      <div class="header-content">
        <!-- Logo/Brand -->
        <NuxtLink to="/" class="brand-link">
          <div class="brand">
            <span class="brand-icon">◈</span>
            <span class="brand-text">{{ t('common.appName') }}</span>
          </div>
        </NuxtLink>

        <!-- Navigation -->
        <nav class="nav-links">
          <NuxtLink to="/" class="nav-link" :class="{ active: route.path === '/' }">
            {{ t('nav.home') }}
          </NuxtLink>
          <NuxtLink to="/docs" class="nav-link" :class="{ active: route.path.startsWith('/docs') }">
            {{ t('docs.title') }}
          </NuxtLink>
        </nav>

        <!-- Right Section -->
        <div class="header-right">
          <!-- Language Switcher -->
          <el-dropdown trigger="click" @command="switchLanguage">
            <el-button type="default" class="lang-btn">
              <span class="lang-icon">🌐</span>
              <span class="lang-text">{{ currentLangLabel }}</span>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="zh-CN" :class="{ active: locale === 'zh-CN' }">
                  中文
                </el-dropdown-item>
                <el-dropdown-item command="en-US" :class="{ active: locale === 'en-US' }">
                  English
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <!-- User Menu -->
          <template v-if="isAuthenticated">
            <el-dropdown trigger="click" @command="handleUserCommand">
              <div class="user-avatar">
                <el-avatar :size="36" :src="user?.avatar">
                  {{ user?.username?.charAt(0).toUpperCase() }}
                </el-avatar>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile">
                    {{ t('nav.profile') }}
                  </el-dropdown-item>
                  <el-dropdown-item command="settings">
                    {{ t('nav.settings') }}
                  </el-dropdown-item>
                  <el-dropdown-item divided command="logout">
                    {{ t('nav.logout') }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
          <template v-else>
            <div class="auth-buttons">
              <NuxtLink to="/login">
                <el-button type="default" size="small">
                  {{ t('nav.login') }}
                </el-button>
              </NuxtLink>
              <NuxtLink to="/register">
                <el-button type="primary" size="small">
                  {{ t('nav.register') }}
                </el-button>
              </NuxtLink>
            </div>
          </template>
        </div>
      </div>
    </el-header>

    <!-- Main Content -->
    <el-main class="layout-main">
      <slot />
    </el-main>

    <!-- Footer -->
    <el-footer class="layout-footer">
      <div class="footer-content">
        <p class="copyright">{{ t('footer.copyright') }}</p>
        <div class="footer-links">
          <a href="#" class="footer-link">{{ t('footer.about') }}</a>
          <span class="divider">|</span>
          <a href="#" class="footer-link">{{ t('footer.privacy') }}</a>
          <span class="divider">|</span>
          <a href="#" class="footer-link">{{ t('footer.terms') }}</a>
          <span class="divider">|</span>
          <a href="#" class="footer-link">{{ t('footer.contact') }}</a>
        </div>
      </div>
    </el-footer>
  </el-container>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

// Auth state
const { isAuthenticated, user, logout } = useAuth()

// Language
const currentLangLabel = computed(() => {
  return locale.value === 'zh-CN' ? '中文' : 'EN'
})

const switchLanguage = (lang: string) => {
  locale.value = lang
  // Persist language preference
  if (import.meta.client) {
    localStorage.setItem('locale', lang)
  }
}

// User menu actions
const handleUserCommand = (command: string) => {
  switch (command) {
    case 'profile':
      router.push('/profile')
      break
    case 'settings':
      router.push('/settings')
      break
    case 'logout':
      logout()
      break
  }
}

// Initialize locale from storage
onMounted(() => {
  const savedLocale = localStorage.getItem('locale')
  if (savedLocale) {
    locale.value = savedLocale
  }
})
</script>

<style scoped>
.default-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%);
}

/* Header Styles */
.layout-header {
  height: auto;
  padding: 0;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand-link {
  text-decoration: none;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  font-size: 28px;
  color: #409eff;
  text-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

.brand-text {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  letter-spacing: -0.5px;
}

.nav-links {
  display: flex;
  gap: 8px;
}

.nav-link {
  padding: 8px 16px;
  text-decoration: none;
  color: #606266;
  font-size: 14px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  color: #409eff;
  background: rgba(64, 158, 255, 0.08);
}

.nav-link.active {
  color: #409eff;
  background: rgba(64, 158, 255, 0.12);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.lang-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 8px 12px;
}

.lang-btn:hover {
  background: rgba(0, 0, 0, 0.04);
}

.lang-icon {
  font-size: 16px;
}

.lang-text {
  font-size: 13px;
  font-weight: 500;
}

.auth-buttons {
  display: flex;
  gap: 8px;
}

.user-avatar {
  cursor: pointer;
  padding: 4px;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.user-avatar:hover {
  background: rgba(64, 158, 255, 0.1);
}

/* Main Content */
.layout-main {
  flex: 1;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
}

/* Footer Styles */
.layout-footer {
  height: auto;
  padding: 24px;
  background: rgba(255, 255, 255, 0.6);
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.copyright {
  color: #909399;
  font-size: 13px;
  margin: 0 0 12px;
}

.footer-links {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.footer-link {
  color: #606266;
  text-decoration: none;
  font-size: 13px;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: #409eff;
}

.divider {
  color: #dcdfe6;
  font-size: 12px;
}

/* Dropdown active state */
:deep(.el-dropdown-menu__item.active) {
  color: #409eff;
  background-color: rgba(64, 158, 255, 0.1);
}
</style>
