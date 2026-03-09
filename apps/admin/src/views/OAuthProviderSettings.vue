<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import {
  Edit,
  ChatDotRound,
  Message,
  ChatLineRound,
  VideoCamera,
  User,
  Search,
} from '@element-plus/icons-vue';
import { getOAuthProviders, updateOAuthProvider, getProvidersMetadata } from '@/api/oauth-provider';
import { extractApiError } from '@/api';
import type { OAuthProvider, UpdateOAuthProviderDto, ProviderMetadata } from '@/api/oauth-provider';

// ============================================
// Types
// ============================================
interface ProviderConfig {
  type: string;
  name: string;
  icon: typeof ChatDotRound;
  color: string;
}

// ============================================
// State
// ============================================
const loading = ref(false);
const providers = ref<OAuthProvider[]>([]);
const dialogVisible = ref(false);
const formLoading = ref(false);
const currentProvider = ref<OAuthProvider | null>(null);
const formRef = ref();

const form = reactive<UpdateOAuthProviderDto>({
  name: '',
  clientId: '',
  clientSecret: '',
  authorizationUrl: '',
  tokenUrl: '',
  userInfoUrl: '',
  scope: '',
  isActive: false,
});

// Provider metadata
const metadataLoading = ref(false);
const providerMetadata = ref<ProviderMetadata[]>([]);

// Icon mapping
const iconMap: Record<string, typeof ChatDotRound> = {
  ChatDotRound,
  Message,
  ChatLineRound,
  VideoCamera,
  User,
  Search,
};

// Fallback config (used when API fails)
const fallbackConfigs: ProviderConfig[] = [
  { type: 'wechat', name: '微信', icon: ChatDotRound, color: '#07C160' },
  { type: 'dingtalk', name: '钉钉', icon: Message, color: '#0089FF' },
  { type: 'feishu', name: '飞书', icon: ChatLineRound, color: '#3370FF' },
  { type: 'douyin', name: '抖音', icon: VideoCamera, color: '#000000' },
  { type: 'qq', name: 'QQ', icon: User, color: '#12B7F5' },
  { type: 'baidu', name: '百度', icon: Search, color: '#2932E1' },
];

// Computed provider configs (merge API data with fallback)
const providerConfigs = computed<ProviderConfig[]>(() => {
  if (providerMetadata.value.length > 0) {
    return [...providerMetadata.value]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((metadata) => ({
        type: metadata.type,
        name: metadata.name,
        icon: iconMap[metadata.icon] || ChatDotRound,
        color: metadata.color,
      }));
  }
  return fallbackConfigs;
});

// ============================================
// Functions
// ============================================
async function fetchProviders() {
  loading.value = true;
  try {
    const response = await getOAuthProviders();
    providers.value = response.data.data;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

async function fetchProviderMetadata() {
  metadataLoading.value = true;
  try {
    const response = await getProvidersMetadata();
    providerMetadata.value = response.data.data;
  } catch {
    ElMessage.warning('使用默认配置');
  } finally {
    metadataLoading.value = false;
  }
}

function getProviderConfig(type: string): ProviderConfig | undefined {
  return providerConfigs.value.find((config) => config.type === type);
}

function getProviderData(type: string): OAuthProvider | undefined {
  return providers.value.find((p) => p.type === type);
}

async function handleToggle(providerType: string, isActive: boolean) {
  const provider = getProviderData(providerType);
  if (!provider) {
    ElMessage.error('提供商配置不存在');
    return;
  }

  try {
    await updateOAuthProvider(provider.id, { isActive });
    ElMessage.success(isActive ? '已启用' : '已禁用');
    await fetchProviders();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
    // Revert the switch on error
    await fetchProviders();
  }
}

function openEditDialog(providerType: string) {
  const provider = getProviderData(providerType);
  if (!provider) {
    ElMessage.error('提供商配置不存在');
    return;
  }

  currentProvider.value = provider;
  form.name = provider.name || '';
  form.clientId = provider.clientId || '';
  form.clientSecret = provider.clientSecret || '';
  form.authorizationUrl = provider.authorizationUrl || '';
  form.tokenUrl = provider.tokenUrl || '';
  form.userInfoUrl = provider.userInfoUrl || '';
  form.scope = provider.scope || '';
  form.isActive = provider.isActive;

  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value || !currentProvider.value) return;

  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  formLoading.value = true;
  try {
    await updateOAuthProvider(currentProvider.value.id, form);
    ElMessage.success('配置更新成功');
    dialogVisible.value = false;
    await fetchProviders();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    formLoading.value = false;
  }
}

function formRules() {
  return {
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    clientId: [{ required: true, message: '请输入 Client ID', trigger: 'blur' }],
  };
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchProviders();
  fetchProviderMetadata();
});
</script>

<template>
  <div class="oauth-provider-settings">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <h2>OAuth 提供商设置</h2>
          <p class="subtitle">配置第三方登录服务提供商</p>
        </div>
      </template>

      <!-- Provider Cards Grid -->
      <div class="providers-grid">
        <el-card
          v-for="config in providerConfigs"
          :key="config.type"
          class="provider-card"
          shadow="hover"
        >
          <div class="provider-header">
            <div class="provider-icon" :style="{ backgroundColor: config.color }">
              <el-icon :size="28">
                <component :is="config.icon" />
              </el-icon>
            </div>
            <div class="provider-info">
              <h3 class="provider-name">{{ config.name }}</h3>
              <span class="provider-type">{{ config.type }}</span>
            </div>
          </div>

          <div class="provider-controls">
            <div class="switch-wrapper">
              <span class="switch-label">{{
                getProviderData(config.type)?.isActive ? '已启用' : '已禁用'
              }}</span>
              <el-switch
                :model-value="getProviderData(config.type)?.isActive || false"
                :loading="loading"
                @change="(val: boolean) => handleToggle(config.type, val)"
              />
            </div>
            <el-button
              type="primary"
              size="small"
              :icon="Edit"
              @click="openEditDialog(config.type)"
            >
              编辑配置
            </el-button>
          </div>
        </el-card>
      </div>

      <!-- Empty State -->
      <el-empty v-if="!loading && providers.length === 0" description="暂无 OAuth 提供商配置" />
    </el-card>

    <!-- Edit Provider Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="`编辑 ${getProviderConfig(currentProvider?.type || '')?.name || ''} 配置`"
      width="640px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules()"
        label-width="120px"
        label-position="top"
      >
        <el-form-item label="名称" prop="name">
          <el-input
            v-model="form.name"
            placeholder="请输入提供商名称"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="Client ID" prop="clientId">
          <el-input
            v-model="form.clientId"
            placeholder="请输入 Client ID / App ID"
            maxlength="255"
          />
        </el-form-item>

        <el-form-item label="Client Secret">
          <el-input
            v-model="form.clientSecret"
            type="password"
            placeholder="请输入 Client Secret / App Secret"
            maxlength="255"
            show-password
          />
        </el-form-item>

        <el-form-item label="Authorization URL">
          <el-input v-model="form.authorizationUrl" placeholder="OAuth 授权地址" maxlength="500" />
        </el-form-item>

        <el-form-item label="Token URL">
          <el-input v-model="form.tokenUrl" placeholder="Token 获取地址" maxlength="500" />
        </el-form-item>

        <el-form-item label="User Info URL">
          <el-input v-model="form.userInfoUrl" placeholder="用户信息获取地址" maxlength="500" />
        </el-form-item>

        <el-form-item label="Scope">
          <el-input
            v-model="form.scope"
            placeholder="OAuth 权限范围，多个用空格分隔"
            maxlength="255"
          />
        </el-form-item>

        <el-form-item label="状态">
          <el-switch v-model="form.isActive" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formLoading" @click="handleSubmit"> 保存 </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.oauth-provider-settings {
  padding: 0;
}

.page-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.page-card :deep(.el-card__body) {
  padding: 24px;
}

.card-header {
  margin-bottom: 8px;
}

.card-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.providers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-top: 24px;
}

.provider-card {
  border-radius: 12px;
  border: 1px solid #ebeef5;
  transition: all 0.3s ease;
}

.provider-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.provider-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}

.provider-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  flex-shrink: 0;
}

.provider-info {
  flex: 1;
  min-width: 0;
}

.provider-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 4px 0;
}

.provider-type {
  font-size: 13px;
  color: #909399;
  text-transform: capitalize;
}

.provider-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.switch-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.switch-label {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

/* Dialog Styles */
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

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
