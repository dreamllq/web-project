<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FormInstance, FormRules } from 'element-plus';
import type { OAuthProvider, UpdateOAuthProviderDto } from '@/api/oauth-provider';

// ============================================
// Props & Emits
// ============================================
interface Props {
  visible?: boolean;
  provider?: OAuthProvider | null;
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  provider: null,
});

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void;
  (e: 'submit', data: UpdateOAuthProviderDto): void;
  (e: 'cancel'): void;
}>();

// ============================================
// State
// ============================================
const { t } = useI18n();
const formRef = ref<FormInstance>();
const formData = ref<UpdateOAuthProviderDto>({
  name: '',
  clientId: '',
  clientSecret: '',
  authorizationUrl: '',
  tokenUrl: '',
  userInfoUrl: '',
  scope: '',
});

// ============================================
// Computed
// ============================================
const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
});

const dialogTitle = computed(() => {
  return t('oauth.providers.editProvider');
});

// ============================================
// Form Rules
// ============================================
const rules: FormRules<UpdateOAuthProviderDto> = {
  name: [
    {
      required: true,
      message: t('oauth.providers.nameRequired'),
      trigger: 'blur',
    },
    {
      min: 2,
      max: 100,
      message: t('oauth.providers.nameLength'),
      trigger: 'blur',
    },
  ],
  clientId: [
    {
      required: true,
      message: t('oauth.providers.clientIdRequired'),
      trigger: 'blur',
    },
  ],
};

// ============================================
// Watchers
// ============================================
watch(
  () => props.visible,
  (visible) => {
    if (visible && props.provider) {
      // Edit mode: populate form
      formData.value = {
        name: props.provider.name,
        clientId: props.provider.clientId,
        clientSecret: props.provider.clientSecret || '',
        authorizationUrl: props.provider.authorizationUrl || '',
        tokenUrl: props.provider.tokenUrl || '',
        userInfoUrl: props.provider.userInfoUrl || '',
        scope: props.provider.scope || '',
      };
    } else if (visible) {
      // Reset form
      formData.value = {
        name: '',
        clientId: '',
        clientSecret: '',
        authorizationUrl: '',
        tokenUrl: '',
        userInfoUrl: '',
        scope: '',
      };
    }
  }
);

// ============================================
// Methods
// ============================================
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
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="600px"
    :close-on-click-modal="false"
    @close="handleCancel"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px"
      label-position="top"
    >
      <el-form-item :label="t('oauth.providers.name')" prop="name">
        <el-input
          v-model="formData.name"
          :placeholder="t('oauth.providers.namePlaceholder')"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>

      <el-form-item :label="t('oauth.providers.clientId')" prop="clientId">
        <el-input
          v-model="formData.clientId"
          :placeholder="t('oauth.providers.clientIdPlaceholder')"
          maxlength="255"
        />
      </el-form-item>

      <el-form-item :label="t('oauth.providers.clientSecret')" prop="clientSecret">
        <el-input
          v-model="formData.clientSecret"
          type="password"
          :placeholder="t('oauth.providers.clientSecretPlaceholder')"
          maxlength="255"
          show-password
        />
      </el-form-item>

      <el-form-item :label="t('oauth.providers.authorizationUrl')" prop="authorizationUrl">
        <el-input
          v-model="formData.authorizationUrl"
          :placeholder="t('oauth.providers.authorizationUrlPlaceholder')"
          maxlength="500"
        />
        <div class="form-hint">{{ t('oauth.providers.authorizationUrlHint') }}</div>
      </el-form-item>

      <el-form-item :label="t('oauth.providers.tokenUrl')" prop="tokenUrl">
        <el-input
          v-model="formData.tokenUrl"
          :placeholder="t('oauth.providers.tokenUrlPlaceholder')"
          maxlength="500"
        />
        <div class="form-hint">{{ t('oauth.providers.tokenUrlHint') }}</div>
      </el-form-item>

      <el-form-item :label="t('oauth.providers.userInfoUrl')" prop="userInfoUrl">
        <el-input
          v-model="formData.userInfoUrl"
          :placeholder="t('oauth.providers.userInfoUrlPlaceholder')"
          maxlength="500"
        />
        <div class="form-hint">{{ t('oauth.providers.userInfoUrlHint') }}</div>
      </el-form-item>

      <el-form-item :label="t('oauth.providers.scope')" prop="scope">
        <el-input
          v-model="formData.scope"
          :placeholder="t('oauth.providers.scopePlaceholder')"
          maxlength="255"
        />
        <div class="form-hint">{{ t('oauth.providers.scopeHint') }}</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="handleSubmit">
        {{ t('common.update') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
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
</style>
