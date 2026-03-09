<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FormInstance, FormRules } from 'element-plus';
import type { OAuthProvider, UpdateProviderMetadataDto } from '@/api/oauth-provider';

// ============================================
// Props & Emits
// ============================================
interface Props {
  modelValue: OAuthProvider | null;
  visible: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: OAuthProvider | null): void;
  (e: 'update:visible', value: boolean): void;
  (e: 'submit', data: UpdateProviderMetadataDto): void;
  (e: 'cancel'): void;
}>();

// ============================================
// State
// ============================================
const { t } = useI18n();
const formRef = ref<FormInstance>();
const formData = ref<UpdateProviderMetadataDto>({
  displayName: undefined,
  icon: undefined,
  color: undefined,
  sortOrder: undefined,
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

const provider = computed(() => props.modelValue);

// ============================================
// Form Rules
// ============================================
const rules: FormRules<UpdateProviderMetadataDto> = {
  displayName: [
    {
      max: 100,
      message: t('oauth.providers.displayNameMaxLength'),
      trigger: 'blur',
    },
  ],
  icon: [
    {
      max: 255,
      message: t('oauth.providers.iconMaxLength'),
      trigger: 'blur',
    },
  ],
  color: [
    {
      max: 50,
      message: t('oauth.providers.colorMaxLength'),
      trigger: 'blur',
    },
  ],
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

// ============================================
// Watchers
// ============================================
watch(
  () => props.visible,
  (visible) => {
    if (visible && props.modelValue) {
      // Edit mode: populate form with existing metadata
      formData.value = {
        displayName: props.modelValue.displayName ?? undefined,
        icon: props.modelValue.icon ?? undefined,
        color: props.modelValue.color ?? undefined,
        sortOrder: props.modelValue.sortOrder ?? undefined,
      };
    } else if (visible) {
      // Reset form when opening without provider
      formData.value = {
        displayName: undefined,
        icon: undefined,
        color: undefined,
        sortOrder: undefined,
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

function handleColorInput(value: string) {
  // Ensure color value starts with # for hex colors
  if (value && !value.startsWith('#') && !value.startsWith('rgb')) {
    formData.value.color = `#${value}`;
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="560px"
    :close-on-click-modal="false"
    @close="handleCancel"
  >
    <!-- Provider Info Section (Readonly) -->
    <div v-if="provider" class="provider-info">
      <div class="info-title">{{ t('oauth.providers.basicInfo') }}</div>
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item :label="t('oauth.providers.code')">
          <el-tag size="small">{{ provider.code }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('oauth.providers.name')">
          {{ provider.name }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('oauth.providers.appId')">
          <span class="mono-text">{{ provider.appId }}</span>
        </el-descriptions-item>
        <el-descriptions-item :label="t('oauth.providers.providerType')">
          <el-tag type="info" size="small">{{ provider.providerType || '-' }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>
    </div>

    <el-divider />

    <!-- Editable Form Fields -->
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px"
      label-position="top"
    >
      <el-form-item :label="t('oauth.providers.displayName')" prop="displayName">
        <el-input
          v-model="formData.displayName"
          :placeholder="t('oauth.providers.displayNamePlaceholder')"
          maxlength="100"
          clearable
        />
        <div class="form-hint">{{ t('oauth.providers.displayNameHint') }}</div>
      </el-form-item>

      <el-form-item :label="t('oauth.providers.icon')" prop="icon">
        <el-input
          v-model="formData.icon"
          :placeholder="t('oauth.providers.iconPlaceholder')"
          maxlength="255"
          clearable
        />
        <div class="form-hint">{{ t('oauth.providers.iconHint') }}</div>
      </el-form-item>

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
.provider-info {
  margin-bottom: 16px;
}

.info-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 12px;
}

.mono-text {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
  font-size: 12px;
}

.color-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-input-wrapper .el-input {
  flex: 1;
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

:deep(.el-descriptions) {
  margin-top: 8px;
}

:deep(.el-descriptions__label) {
  font-weight: 500;
  color: #606266;
}
</style>
