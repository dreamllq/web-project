<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FormInstance, FormRules } from 'element-plus';
import type { OAuthClient, CreateOAuthClientDto } from '@/api/oauth';

// ============================================
// Props & Emits
// ============================================
interface Props {
  modelValue?: OAuthClient | null;
  visible?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  visible: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: OAuthClient | null): void;
  (e: 'update:visible', value: boolean): void;
  (e: 'submit', data: CreateOAuthClientDto): void;
  (e: 'cancel'): void;
}>();

// ============================================
// State
// ============================================
const { t } = useI18n();
const formRef = ref<FormInstance>();
const formData = ref<CreateOAuthClientDto>({
  name: '',
  redirectUris: [],
  scopes: [],
  isConfidential: true,
});

// ============================================
// Computed
// ============================================
const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
});

const dialogTitle = computed(() => {
  return props.modelValue ? t('oauth.clients.editClient') : t('oauth.clients.createClient');
});

const isEditMode = computed(() => !!props.modelValue);

// ============================================
// Form Rules
// ============================================
const rules: FormRules<CreateOAuthClientDto> = {
  name: [
    {
      required: true,
      message: t('oauth.clients.nameRequired'),
      trigger: 'blur',
    },
    {
      min: 3,
      max: 100,
      message: t('oauth.clients.nameLength'),
      trigger: 'blur',
    },
  ],
  redirectUris: [
    {
      required: true,
      message: t('oauth.clients.redirectUrisRequired'),
      trigger: 'change',
      type: 'array',
      min: 1,
    },
  ],
};

// ============================================
// Watchers
// ============================================
watch(
  () => props.visible,
  (visible) => {
    if (visible && props.modelValue) {
      // Edit mode: populate form
      formData.value = {
        name: props.modelValue.name,
        redirectUris: [...props.modelValue.redirectUris],
        scopes: props.modelValue.allowedScopes || [],
        isConfidential: props.modelValue.isConfidential ?? true,
      };
    } else if (visible) {
      // Create mode: reset form
      formData.value = {
        name: '',
        redirectUris: [],
        scopes: [],
        isConfidential: true,
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
      <el-form-item :label="t('oauth.clients.name')" prop="name">
        <el-input
          v-model="formData.name"
          :placeholder="t('oauth.clients.namePlaceholder')"
          maxlength="100"
          show-word-limit
        />
      </el-form-item>

      <el-form-item :label="t('oauth.clients.redirectUris')" prop="redirectUris">
        <el-select
          v-model="formData.redirectUris"
          multiple
          filterable
          allow-create
          default-first-option
          :placeholder="t('oauth.clients.redirectUrisPlaceholder')"
          class="full-width"
        >
          <el-option v-for="uri in formData.redirectUris" :key="uri" :label="uri" :value="uri" />
        </el-select>
        <div class="form-hint">{{ t('oauth.clients.redirectUrisHint') }}</div>
      </el-form-item>

      <el-form-item :label="t('oauth.clients.scopes')" prop="scopes">
        <el-select
          v-model="formData.scopes"
          multiple
          filterable
          allow-create
          default-first-option
          :placeholder="t('oauth.clients.scopesPlaceholder')"
          class="full-width"
        >
          <el-option v-for="scope in formData.scopes" :key="scope" :label="scope" :value="scope" />
        </el-select>
        <div class="form-hint">{{ t('oauth.clients.scopesHint') }}</div>
      </el-form-item>

      <el-form-item :label="t('oauth.clients.isConfidential')" prop="isConfidential">
        <el-switch v-model="formData.isConfidential" />
        <div class="form-hint">{{ t('oauth.clients.isConfidentialHint') }}</div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">{{ t('common.cancel') }}</el-button>
      <el-button type="primary" @click="handleSubmit">
        {{ isEditMode ? t('common.update') : t('common.create') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.full-width {
  width: 100%;
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
</style>
