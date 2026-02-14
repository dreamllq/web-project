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
            {{ t('docs.oauthOverview') }}
          </a>
          <a href="#register" class="toc-link" :class="{ active: activeSection === 'register' }">
            {{ t('docs.oauthRegister') }}
          </a>
          <a href="#flow" class="toc-link" :class="{ active: activeSection === 'flow' }">
            {{ t('docs.oauthFlow') }}
          </a>
          <a href="#endpoints" class="toc-link" :class="{ active: activeSection === 'endpoints' }">
            {{ t('docs.oauthEndpoints') }}
          </a>
          <a href="#examples" class="toc-link" :class="{ active: activeSection === 'examples' }">
            {{ t('docs.oauthExamples') }}
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
            <span class="badge-icon">🔐</span>
            <span class="badge-text">OAuth 2.0</span>
          </div>
          <h1 class="docs-title">{{ t('docs.oauthGuide') }}</h1>
          <p class="docs-description">
            {{ t('docs.oauthGuideDesc') }}
          </p>
        </header>

        <!-- Overview Section -->
        <section id="overview" class="doc-section">
          <h2 class="section-title">
            <span class="section-icon">📋</span>
            {{ t('docs.oauthOverview') }}
          </h2>
          <div class="section-content">
            <p>{{ t('docs.oauthOverviewText1') }}</p>
            <p>{{ t('docs.oauthOverviewText2') }}</p>
            
            <div class="highlight-box">
              <div class="highlight-title">
                <el-icon><InfoFilled /></el-icon>
                {{ t('docs.supportedProviders') }}
              </div>
              <div class="provider-tags">
                <el-tag type="success" effect="dark">WeChat</el-tag>
                <el-tag type="primary" effect="dark">DingTalk</el-tag>
              </div>
            </div>
          </div>
        </section>

        <!-- Register Section -->
        <section id="register" class="doc-section">
          <h2 class="section-title">
            <span class="section-icon">📝</span>
            {{ t('docs.oauthRegister') }}
          </h2>
          <div class="section-content">
            <p>{{ t('docs.oauthRegisterText') }}</p>
            
            <div class="steps">
              <div class="step">
                <div class="step-number">1</div>
                <div class="step-content">
                  <h4>{{ t('docs.step1Title') }}</h4>
                  <p>{{ t('docs.step1Desc') }}</p>
                </div>
              </div>
              <div class="step">
                <div class="step-number">2</div>
                <div class="step-content">
                  <h4>{{ t('docs.step2Title') }}</h4>
                  <p>{{ t('docs.step2Desc') }}</p>
                </div>
              </div>
              <div class="step">
                <div class="step-number">3</div>
                <div class="step-content">
                  <h4>{{ t('docs.step3Title') }}</h4>
                  <p>{{ t('docs.step3Desc') }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Flow Section -->
        <section id="flow" class="doc-section">
          <h2 class="section-title">
            <span class="section-icon">🔄</span>
            {{ t('docs.oauthFlow') }}
          </h2>
          <div class="section-content">
            <p>{{ t('docs.oauthFlowText') }}</p>
            
            <div class="flow-diagram">
              <div class="flow-step">
                <div class="flow-icon">1️⃣</div>
                <div class="flow-text">
                  <strong>{{ t('docs.flow1Title') }}</strong>
                  <p>{{ t('docs.flow1Desc') }}</p>
                </div>
              </div>
              <div class="flow-arrow">↓</div>
              <div class="flow-step">
                <div class="flow-icon">2️⃣</div>
                <div class="flow-text">
                  <strong>{{ t('docs.flow2Title') }}</strong>
                  <p>{{ t('docs.flow2Desc') }}</p>
                </div>
              </div>
              <div class="flow-arrow">↓</div>
              <div class="flow-step">
                <div class="flow-icon">3️⃣</div>
                <div class="flow-text">
                  <strong>{{ t('docs.flow3Title') }}</strong>
                  <p>{{ t('docs.flow3Desc') }}</p>
                </div>
              </div>
              <div class="flow-arrow">↓</div>
              <div class="flow-step">
                <div class="flow-icon">4️⃣</div>
                <div class="flow-text">
                  <strong>{{ t('docs.flow4Title') }}</strong>
                  <p>{{ t('docs.flow4Desc') }}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Endpoints Section -->
        <section id="endpoints" class="doc-section">
          <h2 class="section-title">
            <span class="section-icon">🔗</span>
            {{ t('docs.oauthEndpoints') }}
          </h2>
          <div class="section-content">
            <div class="endpoint-table">
              <div class="endpoint-row header">
                <div class="endpoint-method">{{ t('docs.method') }}</div>
                <div class="endpoint-path">{{ t('docs.endpoint') }}</div>
                <div class="endpoint-desc">{{ t('docs.description') }}</div>
              </div>
              <div class="endpoint-row">
                <div class="endpoint-method"><el-tag type="primary" size="small">GET</el-tag></div>
                <div class="endpoint-path"><code>/oauth/authorize</code></div>
                <div class="endpoint-desc">{{ t('docs.authorizeDesc') }}</div>
              </div>
              <div class="endpoint-row">
                <div class="endpoint-method"><el-tag type="success" size="small">POST</el-tag></div>
                <div class="endpoint-path"><code>/oauth/token</code></div>
                <div class="endpoint-desc">{{ t('docs.tokenDesc') }}</div>
              </div>
              <div class="endpoint-row">
                <div class="endpoint-method"><el-tag type="primary" size="small">GET</el-tag></div>
                <div class="endpoint-path"><code>/oauth/userinfo</code></div>
                <div class="endpoint-desc">{{ t('docs.userinfoDesc') }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Examples Section -->
        <section id="examples" class="doc-section">
          <h2 class="section-title">
            <span class="section-icon">💻</span>
            {{ t('docs.oauthExamples') }}
          </h2>
          <div class="section-content">
            <el-tabs v-model="activeTab" class="code-tabs">
              <el-tab-pane label="Authorization URL" name="auth">
                <div class="code-block">
                  <div class="code-header">
                    <span>{{ t('docs.authUrlExample') }}</span>
                    <el-button size="small" text @click="copyCode('auth')">
                      <el-icon><CopyDocument /></el-icon>
                    </el-button>
                  </div>
                  <pre><code>{{ authUrlExample }}</code></pre>
                </div>
              </el-tab-pane>
              <el-tab-pane label="Token Request" name="token">
                <div class="code-block">
                  <div class="code-header">
                    <span>{{ t('docs.tokenRequestExample') }}</span>
                    <el-button size="small" text @click="copyCode('token')">
                      <el-icon><CopyDocument /></el-icon>
                    </el-button>
                  </div>
                  <pre><code>{{ tokenRequestExample }}</code></pre>
                </div>
              </el-tab-pane>
              <el-tab-pane label="User Info" name="userinfo">
                <div class="code-block">
                  <div class="code-header">
                    <span>{{ t('docs.userinfoExample') }}</span>
                    <el-button size="small" text @click="copyCode('userinfo')">
                      <el-icon><CopyDocument /></el-icon>
                    </el-button>
                  </div>
                  <pre><code>{{ userinfoExample }}</code></pre>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { Document, Connection, Key, ChatDotRound, InfoFilled, CopyDocument } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'

const { t } = useI18n()
const route = useRoute()
const config = useRuntimeConfig()

const activeSection = ref('overview')
const activeTab = ref('auth')

const authUrlExample = computed(() => `GET ${config.public.apiBase}/oauth/authorize?
  response_type=code&
  client_id=YOUR_CLIENT_ID&
  redirect_uri=YOUR_REDIRECT_URI&
  scope=openid profile&
  state=RANDOM_STATE_STRING`)

const tokenRequestExample = computed(() => `POST ${config.public.apiBase}/oauth/token
Content-Type: application/json

{
  "grant_type": "authorization_code",
  "code": "AUTHORIZATION_CODE",
  "redirect_uri": "YOUR_REDIRECT_URI",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET"
}`)

const userinfoExample = computed(() => `GET ${config.public.apiBase}/oauth/userinfo
Authorization: Bearer ACCESS_TOKEN

// Response:
{
  "id": "12345",
  "username": "johndoe",
  "email": "john@example.com",
  "nickname": "John Doe",
  "avatar": "https://example.com/avatar.jpg"
}`)

const copyCode = async (type: string) => {
  const code = type === 'auth' ? authUrlExample.value 
    : type === 'token' ? tokenRequestExample.value 
    : userinfoExample.value
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
  title: `OAuth 2.0 - 4A User Center`,
  meta: [
    { name: 'description', content: t('docs.oauthGuideDesc') },
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
  background: linear-gradient(135deg, rgba(230, 162, 60, 0.1) 0%, rgba(245, 108, 108, 0.1) 100%);
  border-radius: 24px;
  margin-bottom: 20px;
  border: 1px solid rgba(230, 162, 60, 0.15);
}

.badge-icon {
  font-size: 14px;
}

.badge-text {
  font-size: 13px;
  font-weight: 600;
  color: #e6a23c;
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

.section-content p {
  margin-bottom: 16px;
}

.section-content p:last-child {
  margin-bottom: 0;
}

/* Highlight Box */
.highlight-box {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.05) 0%, rgba(103, 194, 58, 0.05) 100%);
  border: 1px solid rgba(64, 158, 255, 0.1);
  border-radius: 12px;
  padding: 20px;
  margin-top: 20px;
}

.highlight-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.provider-tags {
  display: flex;
  gap: 8px;
}

/* Steps */
.steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 20px;
}

.step {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.04);
}

.step-number {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #409eff 0%, #67c23a 100%);
  color: white;
  font-weight: 600;
  border-radius: 8px;
  flex-shrink: 0;
}

.step-content h4 {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 6px;
}

.step-content p {
  font-size: 14px;
  color: #606266;
  margin: 0;
}

/* Flow Diagram */
.flow-diagram {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-top: 20px;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.flow-step {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: rgba(64, 158, 255, 0.03);
  border-radius: 10px;
}

.flow-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.flow-text strong {
  display: block;
  font-size: 14px;
  color: #303133;
  margin-bottom: 4px;
}

.flow-text p {
  font-size: 13px;
  color: #909399;
  margin: 0;
}

.flow-arrow {
  text-align: center;
  font-size: 20px;
  color: #c0c4cc;
  padding: 8px 0;
}

/* Endpoint Table */
.endpoint-table {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.endpoint-row {
  display: grid;
  grid-template-columns: 80px 1fr 1.5fr;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
}

.endpoint-row:last-child {
  border-bottom: none;
}

.endpoint-row.header {
  background: rgba(0, 0, 0, 0.02);
  font-weight: 600;
  color: #303133;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.endpoint-method {
  display: flex;
  align-items: center;
}

.endpoint-path code {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
  background: rgba(64, 158, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  color: #409eff;
}

.endpoint-desc {
  color: #606266;
  font-size: 14px;
}

/* Code Block */
.code-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.code-block {
  background: #1e1e1e;
  border-radius: 0 0 12px 12px;
  overflow: hidden;
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
}

.code-block code {
  font-family: 'SF Mono', Monaco, 'Andale Mono', monospace;
  font-size: 13px;
  color: #d4d4d4;
  white-space: pre;
  line-height: 1.6;
}

/* Responsive */
@media (max-width: 1024px) {
  .endpoint-row {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .endpoint-row.header {
    display: none;
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

  .step {
    flex-direction: column;
    text-align: center;
  }

  .step-number {
    margin: 0 auto;
  }
}
</style>
