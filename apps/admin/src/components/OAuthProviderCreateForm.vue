<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { CopyDocument } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import type { CreateProviderDto, OAuthProviderCode } from '@/api/oauth-provider';

interface Props {
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'submit', data: CreateProviderDto): void;
  (e: 'cancel'): void;
}>();

const { t } = useI18n();
const formRef = ref<FormInstance>();
const formData = ref<CreateProviderDto>({
  code: '' as OAuthProviderCode,
  configName: '',
  appId: '',
  appSecret: '',
  redirectUri: '',
  frontendRedirectUrl: '',
  displayName: '',
  icon: '',
  color: '',
  sortOrder: 0,
  isDefault: false,
});

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
});

// Get backend URL from current location (admin runs on same origin as API via proxy)
const backendUrl = ref(typeof window !== 'undefined' ? window.location.origin : '');

// Compute callback URL based on selected provider
const generatedCallbackUrl = computed(() => {
  if (!formData.value.code || !backendUrl.value) return '';

  // Miniprogram providers don't need redirect URI
  if (formData.value.code.endsWith('_miniprogram')) {
    return '';
  }

  return `${backendUrl.value}/api/auth/oauth/${formData.value.code}/callback`;
});

// Provider type options
const providerCodeOptions = [
  { value: 'wechat', label: '微信' },
  { value: 'wechat_miniprogram', label: '微信小程序' },
  { value: 'dingtalk', label: '钉钉' },
  { value: 'dingtalk_miniprogram', label: '钉钉小程序' },
  { value: 'feishu', label: '飞书' },
  { value: 'douyin', label: '抖音' },
  { value: 'qq', label: 'QQ' },
  { value: 'baidu', label: '百度' },
];

// Auto-fill redirect URI when provider or backend URL changes
watch([() => formData.value.code, backendUrl], ([newCode, newUrl]) => {
  if (newCode && newUrl && !newCode.endsWith('_miniprogram')) {
    formData.value.redirectUri = `${newUrl}/api/auth/oauth/${newCode}/callback`;
  }
});

const rules: FormRules<CreateProviderDto> = {
  code: [{ required: true, message: t('oauth.providers.codeRequired'), trigger: 'change' }],
  configName: [
    { required: true, message: t('oauth.providers.configNameRequired'), trigger: 'blur' },
    { max: 100, message: t('oauth.providers.configNameMaxLength'), trigger: 'blur' },
  ],
  appId: [
    { required: true, message: t('oauth.providers.appIdRequired'), trigger: 'blur' },
    { max: 255, message: t('oauth.providers.appIdMaxLength'), trigger: 'blur' },
  ],
  appSecret: [
    { required: true, message: t('oauth.providers.appSecretRequired'), trigger: 'blur' },
    { max: 255, message: t('oauth.providers.appSecretMaxLength'), trigger: 'blur' },
  ],
  redirectUri: [{ max: 500, message: t('oauth.providers.redirectUriMaxLength'), trigger: 'blur' }],
  displayName: [{ max: 100, message: t('oauth.providers.displayNameMaxLength'), trigger: 'blur' }],
  icon: [{ max: 255, message: t('oauth.providers.iconMaxLength'), trigger: 'blur' }],
  color: [{ max: 50, message: t('oauth.providers.colorMaxLength'), trigger: 'blur' }],
  sortOrder: [
    {
      type: 'number',
      min: 0,
      max: 999,
      message: t('oauth.providers.sortOrderRange'),
      trigger: 'blur',
    },
  ],
};

async function handleSubmit() {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
    emit('submit', { ...formData.value });
  } catch {
    // Validation failed
  }
}

function handleCancel() {
  emit('cancel');
  dialogVisible.value = false;
}

function handleColorInput(value: string) {
  if (value && !value.startsWith('#') && !value.startsWith('rgb')) {
    formData.value.color = `#${value}`;
  }
}

function resetForm() {
  formData.value = {
    code: '' as OAuthProviderCode,
    configName: '',
    appId: '',
    appSecret: '',
    redirectUri: '',
    displayName: '',
    icon: '',
    color: '',
    sortOrder: 1,
    isDefault: false,
  };
  formRef.value?.resetFields();
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(t('common.copied'));
  } catch {
    ElMessage.error(t('common.copyFailed'));
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('oauth.providers.createProvider')"
    width="640px"
    :close-on-click-modal="false"
    @closed="resetForm"
    @close="handleCancel"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px"
      label-position="top"
    >
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('oauth.providers.code')" prop="code">
            <el-select
              v-model="formData.code"
              :placeholder="t('oauth.providers.selectCode')"
              style="width: 100%"
            >
              <el-option
                v-for="item in providerCodeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('oauth.providers.configName')" prop="configName">
            <el-input
              v-model="formData.configName"
              :placeholder="t('oauth.providers.configNamePlaceholder')"
              maxlength="100"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('oauth.providers.appId')" prop="appId">
            <el-input
              v-model="formData.appId"
              :placeholder="t('oauth.providers.appIdPlaceholder')"
              maxlength="255"
              clearable
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('oauth.providers.appSecret')" prop="appSecret">
            <el-input
              v-model="formData.appSecret"
              type="password"
              show-password
              :placeholder="t('oauth.providers.appSecretPlaceholder')"
              maxlength="255"
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item v-if="generatedCallbackUrl" :label="t('oauth.providers.callbackUrl')">
        <div class="callback-url-display">
          <code class="url">{{ generatedCallbackUrl }}</code>
          <el-button
            type="primary"
            link
            :icon="CopyDocument"
            @click="copyToClipboard(generatedCallbackUrl)"
          >
            {{ t('common.copy') }}
          </el-button>
        </div>
        <div class="form-hint">{{ t('oauth.providers.callbackUrlHint') }}</div>
      </el-form-item>

      <el-form-item
        v-if="!formData.code.endsWith('_miniprogram')"
        :label="t('oauth.providers.frontendRedirectUrl')"
        prop="frontendRedirectUrl"
      >
        <el-input
          v-model="formData.frontendRedirectUrl"
          :placeholder="t('oauth.providers.frontendRedirectUrlPlaceholder')"
          maxlength="500"
          clearable
        />
        <div class="form-hint">{{ t('oauth.providers.frontendRedirectUrlHint') }}</div>
      </el-form-item>

      <el-divider>{{ t('oauth.providers.displaySettings') }}</el-divider>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('oauth.providers.displayName')" prop="displayName">
            <el-input
              v-model="formData.displayName"
              :placeholder="t('oauth.providers.displayNamePlaceholder')"
              maxlength="100"
              clearable
            />
            <div class="form-hint">{{ t('oauth.providers.displayNameHint') }}</div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('oauth.providers.icon')" prop="icon">
            <el-input
              v-model="formData.icon"
              :placeholder="t('oauth.providers.iconPlaceholder')"
              maxlength="255"
              clearable
            />
            <div class="form-hint">{{ t('oauth.providers.iconHint') }}</div>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item :label="t('oauth.providers.color')" prop="color">
            <div class="color-input-wrapper">
              <el-input
                v-model="formData.color"
                :placeholder="t('oauth.providers.colorPlaceholder')"
                maxlength="50"
                clearable
                @input="handleColorInput"
              />
              <el-color-picker
                v-if="formData.color"
                :model-value="formData.color"
                @update:model-value="formData.color = $event"
              />
            </div>
            <div class="form-hint">{{ t('oauth.providers.colorHint') }}</div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item :label="t('oauth.providers.sortOrder')" prop="sortOrder">
            <el-input-number
              v-model="formData.sortOrder"
              :min="0"
              :max="999"
              :step="10"
              controls-position="right"
            />
            <div class="form-hint">{{ t('oauth.providers.sortOrderHint') }}</div>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item>
        <el-checkbox v-model="formData.isDefault">
          {{ t('oauth.providers.isDefault') }}
        </el-checkbox>
        <div class="form-hint">{{ t('oauth.providers.isDefaultHint') }}</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="handleSubmit">
        {{ t('common.add') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.color-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-input-wrapper .el-input {
  flex: 1;
}

.callback-url-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background-color: #f5f7fa;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}

.callback-url-display .url {
  flex: 1;
  color: #409eff;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
  font-size: 13px;
  word-break: break-all;
}

.redirect-uri-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.redirect-uri-wrapper .redirect-uri-input {
  flex: 1;
}

.callback-example {
  margin-top: 8px;
  padding: 8px 12px;
  background-color: #f5f7fa;
  border-radius: 4px;
  font-size: 12px;
}

.callback-example .label {
  color: #606266;
  margin-right: 8px;
}

.callback-example .url {
  color: #409eff;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
  word-break: break-all;
}

.form-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
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

:deep(.el-divider__text) {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
}
</style>
