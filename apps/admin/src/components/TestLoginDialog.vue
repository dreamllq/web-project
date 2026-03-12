<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Link, User, Check, Loading } from '@element-plus/icons-vue';
import { startTestLogin, getTestLoginResult } from '@/api/oauth-provider';
import type { TestLoginResponse } from '@/api/oauth-provider';
import { extractApiError } from '@/api';

interface Props {
  visible: boolean;
  configId: string;
  providerName: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'success', data: TestLoginResponse): void;
  (e: 'error', error: Error): void;
}>();

const { t } = useI18n();

type StepStatus = 'idle' | 'loading' | 'waiting' | 'success' | 'error';

const status = ref<StepStatus>('idle');
const authUrl = ref<string>('');
const testResult = ref<TestLoginResponse | null>(null);
const errorMessage = ref<string>('');
const authWindow = ref<Window | null>(null);
const pollInterval = ref<ReturnType<typeof setInterval> | null>(null);
const pollCount = ref(0);
const MAX_POLL_COUNT = 120; // 2 minutes max with 1s interval

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
});

const statusText = computed(() => {
  switch (status.value) {
    case 'idle':
      return t('oauth.providers.testLogin.statusIdle');
    case 'loading':
      return t('oauth.providers.testLogin.statusLoading');
    case 'waiting':
      return t('oauth.providers.testLogin.statusWaiting');
    case 'success':
      return t('oauth.providers.testLogin.statusSuccess');
    case 'error':
      return t('oauth.providers.testLogin.statusError');
    default:
      return '';
  }
});

function cleanup() {
  if (pollInterval.value) {
    clearInterval(pollInterval.value);
    pollInterval.value = null;
  }
  if (authWindow.value && !authWindow.value.closed) {
    authWindow.value.close();
    authWindow.value = null;
  }
}

async function startTest() {
  status.value = 'loading';
  errorMessage.value = '';
  testResult.value = null;

  try {
    const response = await startTestLogin(props.configId);
    authUrl.value = response.url;
    status.value = 'waiting';

    authWindow.value = window.open(response.url, '_blank', 'width=600,height=600');

    startPolling();
  } catch (error: unknown) {
    status.value = 'error';
    const apiError = extractApiError(error);
    errorMessage.value = apiError.displayMessage;
    emit('error', new Error(apiError.message));
  }
}

function startPolling() {
  pollCount.value = 0;

  pollInterval.value = setInterval(async () => {
    pollCount.value++;

    if (pollCount.value >= MAX_POLL_COUNT) {
      cleanup();
      status.value = 'error';
      errorMessage.value = t('oauth.providers.testLogin.timeout');
      return;
    }

    if (authWindow.value?.closed) {
      cleanup();
      status.value = 'error';
      errorMessage.value = t('oauth.providers.testLogin.windowClosed');
      return;
    }

    const urlParams = new URLSearchParams(authWindow.value?.location?.search || '');
    const code = urlParams.get('code');

    if (code) {
      cleanup();
      await handleCallback(code);
    }
  }, 1000);
}

async function handleCallback(code: string) {
  status.value = 'loading';

  try {
    const result = await getTestLoginResult(props.configId, code);
    testResult.value = result;
    status.value = 'success';
    emit('success', result);
    ElMessage.success(t('oauth.providers.testLogin.success'));
  } catch (error: unknown) {
    status.value = 'error';
    const apiError = extractApiError(error);
    errorMessage.value = apiError.displayMessage;
    emit('error', new Error(apiError.message));
  }
}

function handleClose() {
  cleanup();
  dialogVisible.value = false;
}

function openAuthUrl() {
  if (authUrl.value) {
    window.open(authUrl.value, '_blank');
  }
}

function handleOpen() {
  if (status.value === 'idle' || status.value === 'error') {
    startTest();
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      cleanup();
      status.value = 'idle';
      authUrl.value = '';
      testResult.value = null;
      errorMessage.value = '';
    }
  }
);

onUnmounted(() => {
  cleanup();
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('oauth.providers.testLogin.title')"
    width="520px"
    :close-on-click-modal="false"
    @open="handleOpen"
    @close="handleClose"
  >
    <div class="test-login-content">
      <div class="provider-header">
        <span class="provider-label">{{ t('oauth.providers.testLogin.provider') }}:</span>
        <el-tag size="small">{{ providerName }}</el-tag>
      </div>

      <el-divider />

      <div v-if="status === 'idle'" class="status-section">
        <el-icon class="status-icon" :size="48"><Link /></el-icon>
        <p class="status-text">{{ statusText }}</p>
      </div>

      <div v-else-if="status === 'loading'" class="status-section">
        <el-icon class="status-icon loading" :size="48"><Loading /></el-icon>
        <p class="status-text">{{ statusText }}</p>
      </div>

      <div v-else-if="status === 'waiting'" class="status-section">
        <el-icon class="status-icon loading" :size="48"><Loading /></el-icon>
        <p class="status-text">{{ statusText }}</p>
        <div class="auth-url-section">
          <p class="hint">{{ t('oauth.providers.testLogin.hint') }}</p>
          <el-input v-model="authUrl" readonly class="url-input">
            <template #append>
              <el-button :icon="Link" @click="openAuthUrl">
                {{ t('oauth.providers.testLogin.open') }}
              </el-button>
            </template>
          </el-input>
        </div>
      </div>

      <div v-else-if="status === 'error'" class="status-section error">
        <el-icon class="status-icon" :size="48" color="#f56c6c">
          <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="M512 64a448 448 0 1 1 0 896 448 448 0 0 1 0-896zm0 192a38.4 38.4 0 0 0-38.4 38.4v230.4a38.4 38.4 0 0 0 76.8 0V294.4A38.4 38.4 0 0 0 512 256zm0 448a38.4 38.4 0 1 0 0-76.8 38.4 38.4 0 0 0 0 76.8z"
            />
          </svg>
        </el-icon>
        <p class="status-text error-text">{{ errorMessage }}</p>
        <el-button type="primary" @click="startTest">
          {{ t('oauth.providers.testLogin.retry') }}
        </el-button>
      </div>

      <div v-else-if="status === 'success' && testResult" class="status-section success">
        <el-icon class="status-icon" :size="48" color="#67c23a"><Check /></el-icon>
        <p class="status-text success-text">{{ statusText }}</p>

        <div class="user-info-card">
          <div class="user-avatar">
            <el-avatar v-if="testResult.avatarUrl" :src="testResult.avatarUrl" :size="64" />
            <el-avatar v-else :size="64">
              <el-icon :size="32"><User /></el-icon>
            </el-avatar>
          </div>

          <el-descriptions :column="1" border size="small">
            <el-descriptions-item :label="t('oauth.providers.testLogin.providerUserId')">
              <span class="mono-text">{{ testResult.providerUserId }}</span>
            </el-descriptions-item>
            <el-descriptions-item :label="t('oauth.providers.testLogin.nickname')">
              {{ testResult.nickname || '-' }}
            </el-descriptions-item>
            <el-descriptions-item :label="t('oauth.providers.testLogin.avatarUrl')">
              <a
                v-if="testResult.avatarUrl"
                :href="testResult.avatarUrl"
                target="_blank"
                class="link"
              >
                {{ testResult.avatarUrl }}
              </a>
              <span v-else>-</span>
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <el-collapse class="raw-data-collapse">
          <el-collapse-item :title="t('oauth.providers.testLogin.rawUserInfo')" name="raw">
            <pre class="raw-data">{{ JSON.stringify(testResult.rawUserInfo, null, 2) }}</pre>
          </el-collapse-item>
        </el-collapse>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">{{ t('common.close') }}</el-button>
      <el-button v-if="status === 'success'" type="primary" @click="startTest">
        {{ t('oauth.providers.testLogin.testAgain') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.test-login-content {
  min-height: 200px;
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-label {
  font-size: 14px;
  color: #606266;
}

.status-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
  gap: 16px;
}

.status-icon {
  color: #409eff;
}

.status-icon.loading {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.status-text {
  font-size: 16px;
  color: #606266;
  margin: 0;
}

.error-text {
  color: #f56c6c;
}

.success-text {
  color: #67c23a;
  font-weight: 600;
}

.auth-url-section {
  width: 100%;
  max-width: 400px;
  margin-top: 8px;
}

.hint {
  font-size: 13px;
  color: #909399;
  margin-bottom: 12px;
  text-align: center;
}

.url-input {
  font-size: 12px;
}

.user-info-card {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.mono-text {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
  font-size: 12px;
  word-break: break-all;
}

.link {
  color: #409eff;
  word-break: break-all;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.raw-data-collapse {
  width: 100%;
  max-width: 400px;
  margin-top: 16px;
}

.raw-data {
  background-color: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
}

:deep(.el-dialog) {
  border-radius: 12px;
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 16px;
}

:deep(.el-dialog__title) {
  font-weight: 600;
  color: #1a1a2e;
}

:deep(.el-dialog__footer) {
  border-top: 1px solid #ebeef5;
  padding-top: 16px;
}

:deep(.el-descriptions) {
  width: 100%;
}

:deep(.el-descriptions__label) {
  font-weight: 500;
  width: 100px;
}
</style>
