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

      <!-- Table of Contents -->
      <div class="toc">
        <div class="toc-title">{{ t('docs.contents') }}</div>
        <div class="toc-list">
          <a href="#overview" class="toc-link" :class="{ active: activeSection === 'overview' }">
            {{ t('docs.mpOverview') }}
          </a>
          <a href="#wechat" class="toc-link" :class="{ active: activeSection === 'wechat' }">
            {{ t('docs.mpWechat') }}
          </a>
          <a href="#dingtalk" class="toc-link" :class="{ active: activeSection === 'dingtalk' }">
            {{ t('docs.mpDingtalk') }}
          </a>
          <a href="#api" class="toc-link" :class="{ active: activeSection === 'api' }">
            {{ t('docs.mpApi') }}
          </a>
        </div>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="docs-content">
      <div class="content-wrapper">
        <!-- Header -->
        <header class="docs-header">
          <div class="header-badge">
            <span class="badge-icon">📱</span>
            <span class="badge-text">{{ t('docs.miniprogram') }}</span>
          </div>
          <h1 class="docs-title">{{ t('docs.miniprogramGuide') }}</h1>
          <p class="docs-description">
            {{ t('docs.miniprogramGuideDesc') }}
          </p>
        </header>

        <!-- Overview Section -->
        <section id="overview" class="doc-section">
          <h2 class="section-title">
            <span class="section-icon">📋</span>
            {{ t('docs.mpOverview') }}
          </h2>
          <div class="section-content">
            <p>{{ t('docs.mpOverviewText1') }}</p>
            <p>{{ t('docs.mpOverviewText2') }}</p>
            
            <div class="provider-cards">
              <div class="provider-card wechat">
                <div class="provider-icon">💬</div>
                <div class="provider-info">
                  <h4>{{ t('docs.mpWechat') }}</h4>
                  <p>{{ t('docs.mpWechatDesc') }}</p>
                </div>
                <el-tag type="success" effect="dark">Supported</el-tag>
              </div>
              <div class="provider-card dingtalk">
                <div class="provider-icon">📌</div>
                <div class="provider-info">
                  <h4>{{ t('docs.mpDingtalk') }}</h4>
                  <p>{{ t('docs.mpDingtalkDesc') }}</p>
                </div>
                <el-tag type="primary" effect="dark">Supported</el-tag>
              </div>
            </div>
          </div>
        </section>

        <!-- WeChat Section -->
        <section id="wechat" class="doc-section">
          <h2 class="section-title">
            <span class="section-icon">💬</span>
            {{ t('docs.mpWechat') }}
          </h2>
          <div class="section-content">
            <p>{{ t('docs.mpWechatText') }}</p>
            
            <h4 class="sub-title">{{ t('docs.loginFlow') }}</h4>
            <div class="flow-steps">
              <div class="flow-step">
                <div class="step-badge">1</div>
                <div class="step-info">
                  <strong>{{ t('docs.wxStep1Title') }}</strong>
                  <p>{{ t('docs.wxStep1Desc') }}</p>
                </div>
              </div>
              <div class="flow-step">
                <div class="step-badge">2</div>
                <div class="step-info">
                  <strong>{{ t('docs.wxStep2Title') }}</strong>
                  <p>{{ t('docs.wxStep2Desc') }}</p>
                </div>
              </div>
              <div class="flow-step">
                <div class="step-badge">3</div>
                <div class="step-info">
                  <strong>{{ t('docs.wxStep3Title') }}</strong>
                  <p>{{ t('docs.wxStep3Desc') }}</p>
                </div>
              </div>
            </div>

            <h4 class="sub-title">{{ t('docs.codeExample') }}</h4>
            <div class="code-block">
              <div class="code-header">
                <span>miniprogram/app.js</span>
                <el-button size="small" text @click="copyCode(wechatCode)">
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
              </div>
              <pre><code>{{ wechatCode }}</code></pre>
            </div>
          </div>
        </section>

        <!-- DingTalk Section -->
        <section id="dingtalk" class="doc-section">
          <h2 class="section-title">
            <span class="section-icon">📌</span>
            {{ t('docs.mpDingtalk') }}
          </h2>
          <div class="section-content">
            <p>{{ t('docs.mpDingtalkText') }}</p>
            
            <h4 class="sub-title">{{ t('docs.loginFlow') }}</h4>
            <div class="flow-steps">
              <div class="flow-step">
                <div class="step-badge dingtalk">1</div>
                <div class="step-info">
                  <strong>{{ t('docs.dtStep1Title') }}</strong>
                  <p>{{ t('docs.dtStep1Desc') }}</p>
                </div>
              </div>
              <div class="flow-step">
                <div class="step-badge dingtalk">2</div>
                <div class="step-info">
                  <strong>{{ t('docs.dtStep2Title') }}</strong>
                  <p>{{ t('docs.dtStep2Desc') }}</p>
                </div>
              </div>
              <div class="flow-step">
                <div class="step-badge dingtalk">3</div>
                <div class="step-info">
                  <strong>{{ t('docs.dtStep3Title') }}</strong>
                  <p>{{ t('docs.dtStep3Desc') }}</p>
                </div>
              </div>
            </div>

            <h4 class="sub-title">{{ t('docs.codeExample') }}</h4>
            <div class="code-block">
              <div class="code-header">
                <span>miniprogram/app.js</span>
                <el-button size="small" text @click="copyCode(dingtalkCode)">
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
              </div>
              <pre><code>{{ dingtalkCode }}</code></pre>
            </div>
          </div>
        </section>

        <!-- API Section -->
        <section id="api" class="doc-section">
          <h2 class="section-title">
            <span class="section-icon">🔗</span>
            {{ t('docs.mpApi') }}
          </h2>
          <div class="section-content">
            <p>{{ t('docs.mpApiText') }}</p>
            
            <div class="api-endpoints">
              <div class="api-endpoint">
                <div class="endpoint-header">
                  <el-tag type="success" size="small">POST</el-tag>
                  <code>/auth/miniprogram/login</code>
                </div>
                <div class="endpoint-body">
                  <p class="endpoint-desc">{{ t('docs.mpLoginDesc') }}</p>
                  <div class="params-table">
                    <div class="param-row header">
                      <span>{{ t('docs.paramName') }}</span>
                      <span>{{ t('docs.paramType') }}</span>
                      <span>{{ t('docs.paramRequired') }}</span>
                      <span>{{ t('docs.paramDesc') }}</span>
                    </div>
                    <div class="param-row">
                      <span><code>provider</code></span>
                      <span>string</span>
                      <span><el-tag type="danger" size="small">Required</el-tag></span>
                      <span>{{ t('docs.paramProvider') }}</span>
                    </div>
                    <div class="param-row">
                      <span><code>code</code></span>
                      <span>string</span>
                      <span><el-tag type="danger" size="small">Required</el-tag></span>
                      <span>{{ t('docs.paramCode') }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="api-endpoint">
                <div class="endpoint-header">
                  <el-tag type="success" size="small">POST</el-tag>
                  <code>/auth/miniprogram/bind</code>
                </div>
                <div class="endpoint-body">
                  <p class="endpoint-desc">{{ t('docs.mpBindDesc') }}</p>
                </div>
              </div>
            </div>

            <h4 class="sub-title">{{ t('docs.responseExample') }}</h4>
            <div class="code-block">
              <div class="code-header">
                <span>{{ t('docs.successResponse') }}</span>
                <el-button size="small" text @click="copyCode(responseExample)">
                  <el-icon><CopyDocument /></el-icon>
                </el-button>
              </div>
              <pre><code>{{ responseExample }}</code></pre>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { Document, Connection, Key, ChatDotRound, CopyDocument } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

const { t } = useI18n()
const route = useRoute()
const config = useRuntimeConfig()

const activeSection = ref('overview')

const wechatCode = `// WeChat Miniprogram Login
// miniprogram/pages/login/login.js

Page({
  data: {
    loading: false
  },

  async handleLogin() {
    this.setData({ loading: true })
    
    try {
      // 1. Get WeChat login code
      const { code } = await wx.login()
      
      if (!code) {
        throw new Error('Login failed')
      }

      // 2. Send code to backend
      const res = await wx.request({
        url: '${config.public.apiBase}/auth/miniprogram/login',
        method: 'POST',
        data: {
          provider: 'wechat',
          code: code
        }
      })

      // 3. Store tokens
      const { accessToken, refreshToken, user } = res.data.data
      
      wx.setStorageSync('accessToken', accessToken)
      wx.setStorageSync('refreshToken', refreshToken)
      wx.setStorageSync('userInfo', user)

      // 4. Navigate to home
      wx.switchTab({ url: '/pages/index/index' })
      
    } catch (error) {
      wx.showToast({
        title: 'Login failed',
        icon: 'error'
      })
    } finally {
      this.setData({ loading: false })
    }
  }
})`

const dingtalkCode = `// DingTalk Miniprogram Login
// miniprogram/pages/login/login.js

Page({
  data: {
    loading: false
  },

  async handleLogin() {
    this.setData({ loading: true })
    
    try {
      // 1. Get DingTalk auth code
      const { authCode } = await dd.getAuthCode()
      
      if (!authCode) {
        throw new Error('Auth failed')
      }

      // 2. Send code to backend
      const res = await dd.httpRequest({
        url: '${config.public.apiBase}/auth/miniprogram/login',
        method: 'POST',
        data: {
          provider: 'dingtalk',
          code: authCode
        }
      })

      // 3. Store tokens
      const { accessToken, refreshToken, user } = res.data.data
      
      dd.setStorage({
        key: 'accessToken',
        value: accessToken
      })
      dd.setStorage({
        key: 'userInfo',
        value: user
      })

      // 4. Navigate to home
      dd.switchTab({ url: '/pages/index/index' })
      
    } catch (error) {
      dd.alert({
        title: 'Login failed',
        content: error.message
      })
    } finally {
      this.setData({ loading: false })
    }
  }
})`

const responseExample = `{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "12345",
      "username": "wx_user_abc123",
      "nickname": "John Doe",
      "avatar": "https://cdn.example.com/avatar.jpg",
      "provider": "wechat",
      "providerId": "openid_123456"
    }
  }
}`

const copyCode = async (code: string) => {
  try {
    await navigator.clipboard.writeText(code)
    ElMessage.success(t('common.success'))
  } catch {
    ElMessage.error(t('common.error'))
  }
}

// Intersection Observer for active section
onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activeSection.value = entry.target.id
        }
      })
    },
    { threshold: 0.3 }
  )

  document.querySelectorAll('.doc-section').forEach((section) => {
    observer.observe(section)
  })
})

// SEO
useHead({
  title: `${t('docs.miniprogram')} - 4A User Center`,
  meta: [
    { name: 'description', content: t('docs.miniprogramGuideDesc') },
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

/* Table of Contents */
.toc {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.toc-title {
  font-size: 12px;
  font-weight: 600;
  color: #909399;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  padding: 0 12px;
}

.toc-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.toc-link {
  padding: 8px 12px;
  font-size: 13px;
  color: #606266;
  text-decoration: none;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.toc-link:hover {
  background: rgba(64, 158, 255, 0.08);
  color: #409eff;
}

.toc-link.active {
  background: rgba(64, 158, 255, 0.1);
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
  margin-bottom: 40px;
}

.header-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(144, 147, 153, 0.1) 0%, rgba(64, 158, 255, 0.1) 100%);
  border-radius: 24px;
  margin-bottom: 20px;
  border: 1px solid rgba(144, 147, 153, 0.15);
}

.badge-icon {
  font-size: 14px;
}

.badge-text {
  font-size: 13px;
  font-weight: 600;
  color: #909399;
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

/* Sections */
.doc-section {
  margin-bottom: 48px;
  scroll-margin-top: 100px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.section-icon {
  font-size: 22px;
}

.section-content {
  color: #606266;
  line-height: 1.8;
}

.section-content > p {
  margin-bottom: 16px;
}

.sub-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin: 24px 0 16px;
}

/* Provider Cards */
.provider-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 20px;
}

.provider-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  background: white;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  transition: all 0.3s ease;
}

.provider-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.provider-card.wechat {
  border-left: 4px solid #07c160;
}

.provider-card.dingtalk {
  border-left: 4px solid #0089ff;
}

.provider-icon {
  font-size: 32px;
}

.provider-info {
  flex: 1;
}

.provider-info h4 {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 4px;
}

.provider-info p {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

/* Flow Steps */
.flow-steps {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.flow-step {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 10px;
}

.step-badge {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #07c160;
  color: white;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  flex-shrink: 0;
}

.step-badge.dingtalk {
  background: #0089ff;
}

.step-info strong {
  display: block;
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
}

.step-info p {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

/* Code Block */
.code-block {
  background: #1e1e1e;
  border-radius: 12px;
  overflow: hidden;
  margin-top: 12px;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #2d2d2d;
  color: #888;
  font-size: 12px;
}

.code-header .el-button {
  color: #888;
}

.code-block pre {
  margin: 0;
  padding: 20px;
  overflow-x: auto;
  max-height: 400px;
}

.code-block code {
  font-family: 'SF Mono', Monaco, 'Andale Mono', monospace;
  font-size: 13px;
  color: #d4d4d4;
  white-space: pre;
  line-height: 1.6;
}

/* API Endpoints */
.api-endpoints {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-top: 16px;
}

.api-endpoint {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.endpoint-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.02);
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.endpoint-header code {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 14px;
  color: #303133;
}

.endpoint-body {
  padding: 20px;
}

.endpoint-desc {
  font-size: 14px;
  color: #606266;
  margin: 0 0 16px;
}

/* Params Table */
.params-table {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 8px;
  overflow: hidden;
}

.param-row {
  display: grid;
  grid-template-columns: 100px 80px 80px 1fr;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  font-size: 13px;
}

.param-row:last-child {
  border-bottom: none;
}

.param-row.header {
  background: rgba(0, 0, 0, 0.04);
  font-weight: 600;
  color: #303133;
  font-size: 12px;
}

.param-row code {
  font-family: 'SF Mono', Monaco, monospace;
  background: rgba(64, 158, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  color: #409eff;
  font-size: 12px;
}

/* Responsive */
@media (max-width: 1024px) {
  .param-row {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
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

  .toc {
    display: none;
  }

  .content-wrapper {
    padding: 24px;
  }

  .docs-title {
    font-size: 24px;
  }

  .provider-card {
    flex-direction: column;
    text-align: center;
  }

  .param-row {
    grid-template-columns: 1fr;
  }

  .param-row.header {
    display: none;
  }
}
</style>
