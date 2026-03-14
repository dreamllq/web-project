<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Edit, Plus, Delete, Connection, CopyDocument } from '@element-plus/icons-vue';
import {
  listProviders,
  getMetadata,
  updateProvider,
  batchEnable,
  batchDisable,
  createProvider,
  deleteProvider,
} from '@/api/oauth-provider';
import { extractApiError } from '@/api';
import type {
  OAuthProvider,
  ProviderMetadata,
  UpdateProviderMetadataDto,
  CreateProviderDto,
} from '@/api/oauth-provider';
import OAuthProviderForm from '@/components/OAuthProviderForm.vue';
import OAuthProviderCreateForm from '@/components/OAuthProviderCreateForm.vue';
import TestLoginDialog from '@/components/TestLoginDialog.vue';

// ============================================
// State
// ============================================
const { t } = useI18n();

const loading = ref(false);
const providers = ref<OAuthProvider[]>([]);
const metadata = ref<ProviderMetadata[]>([]);
const selectedIds = ref<string[]>([]);

// Dialog state
const dialogVisible = ref(false);
const currentProvider = ref<OAuthProvider | null>(null);

// Create dialog state
const createDialogVisible = ref(false);

// Test login dialog state
const testLoginDialogVisible = ref(false);
const testLoginConfig = ref<{ id: string; name: string } | null>(null);

// ============================================
// Computed
// ============================================
const hasSelection = computed(() => selectedIds.value.length > 0);

// Merge providers with metadata for display
const providerList = computed(() => {
  return providers.value.map((provider) => {
    const meta = metadata.value.find((m) => m.code === provider.code);
    return {
      ...provider,
      // Use provider's display settings or metadata defaults
      displayIcon: provider.icon || meta?.icon || null,
      displayColor: provider.color || meta?.color || null,
      displayDisplayName: provider.displayName || meta?.displayName || provider.name,
    };
  });
});

// ============================================
// Methods
// ============================================
async function fetchProviders() {
  loading.value = true;
  try {
    providers.value = await listProviders();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

async function fetchMetadata() {
  try {
    metadata.value = await getMetadata();
  } catch {
    // Silently fail, use provider data directly
  }
}

function handleSelectionChange(selection: OAuthProvider[]) {
  selectedIds.value = selection.map((p) => p.id);
}

function openEditDialog(provider: OAuthProvider) {
  currentProvider.value = { ...provider };
  dialogVisible.value = true;
}

async function handleToggleEnabled(provider: OAuthProvider, enabled: boolean) {
  try {
    // Use batch operations for toggling enabled status
    if (enabled) {
      await batchEnable([provider.id]);
    } else {
      await batchDisable([provider.id]);
    }
    ElMessage.success(enabled ? t('oauth.providers.enabled') : t('oauth.providers.disabled'));
    await fetchProviders();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
    // Revert by refetching
    await fetchProviders();
  }
}

async function handleFormSubmit(data: UpdateProviderMetadataDto) {
  if (!currentProvider.value) return;

  try {
    await updateProvider(currentProvider.value.id, data);
    ElMessage.success(t('oauth.providers.updateSuccess'));
    dialogVisible.value = false;
    await fetchProviders();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

async function handleBatchEnable() {
  if (!hasSelection.value) return;

  try {
    await ElMessageBox.confirm(
      t('oauth.providers.batchEnableConfirm', { count: selectedIds.value.length }),
      t('oauth.providers.batchEnable'),
      { type: 'warning' }
    );

    loading.value = true;
    const result = await batchEnable(selectedIds.value);

    if (result.success) {
      ElMessage.success(
        t('oauth.providers.batchEnableSuccess', { success: selectedIds.value.length })
      );
    }

    selectedIds.value = [];
    await fetchProviders();
  } catch (error: unknown) {
    if (error === 'cancel') return;
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

async function handleBatchDisable() {
  if (!hasSelection.value) return;

  try {
    await ElMessageBox.confirm(
      t('oauth.providers.batchDisableConfirm', { count: selectedIds.value.length }),
      t('oauth.providers.batchDisable'),
      { type: 'warning' }
    );

    loading.value = true;
    const result = await batchDisable(selectedIds.value);

    if (result.success) {
      ElMessage.success(
        t('oauth.providers.batchDisableSuccess', { success: selectedIds.value.length })
      );
    }

    selectedIds.value = [];
    await fetchProviders();
  } catch (error: unknown) {
    if (error === 'cancel') return;
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

function openCreateDialog() {
  createDialogVisible.value = true;
}

async function handleCreateSubmit(data: CreateProviderDto) {
  try {
    await createProvider(data);
    ElMessage.success(t('oauth.providers.createSuccess'));
    createDialogVisible.value = false;
    await fetchProviders();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

async function handleDelete(provider: OAuthProvider) {
  try {
    await ElMessageBox.confirm(
      t('oauth.providers.deleteConfirm', { name: provider.configName || provider.name }),
      t('oauth.providers.delete'),
      {
        type: 'warning',
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
      }
    );

    await deleteProvider(provider.id);
    ElMessage.success(t('oauth.providers.deleteSuccess'));
    await fetchProviders();
  } catch (error: unknown) {
    if (error === 'cancel') return;
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

function openTestLogin(provider: OAuthProvider) {
  testLoginConfig.value = {
    id: provider.id,
    name: provider.configName || provider.displayName || provider.name,
  };
  testLoginDialogVisible.value = true;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(t('common.copied'));
  } catch {
    ElMessage.error(t('common.copyFailed'));
  }
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchProviders();
  fetchMetadata();
});
</script>

<template>
  <div class="oauth-provider-settings">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <h2>{{ t('oauth.providers.title') }}</h2>
            <p class="subtitle">{{ t('oauth.providers.subtitle') }}</p>
          </div>
          <div class="header-actions">
            <el-button type="primary" :icon="Plus" @click="openCreateDialog">
              {{ t('oauth.providers.create') }}
            </el-button>
            <span v-if="hasSelection" class="selection-info">
              {{ t('oauth.providers.selectedCount', { count: selectedIds.length }) }}
            </span>
            <el-button type="success" :disabled="!hasSelection" @click="handleBatchEnable">
              {{ t('oauth.providers.batchEnable') }}
            </el-button>
            <el-button type="danger" :disabled="!hasSelection" @click="handleBatchDisable">
              {{ t('oauth.providers.batchDisable') }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- Provider Table -->
      <el-table :data="providerList" style="width: 100%" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="55" />

        <el-table-column prop="code" :label="t('oauth.providers.code')" width="140">
          <template #default="{ row }">
            <div class="provider-code-cell">
              <div
                v-if="row.displayColor"
                class="provider-color-dot"
                :style="{ backgroundColor: row.displayColor }"
              />
              <el-tag size="small">{{ row.code }}</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="name" :label="t('oauth.providers.name')" width="140" />

        <el-table-column prop="configName" :label="t('oauth.providers.configName')" min-width="140">
          <template #default="{ row }">
            <span>{{ row.configName || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column
          prop="displayName"
          :label="t('oauth.providers.displayName')"
          min-width="160"
        >
          <template #default="{ row }">
            <span>{{ row.displayDisplayName || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="enabled" :label="t('oauth.providers.status')" width="120">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              @change="(val: boolean) => handleToggleEnabled(row, val)"
            />
          </template>
        </el-table-column>

        <el-table-column prop="providerType" :label="t('oauth.providers.providerType')" width="140">
          <template #default="{ row }">
            <el-tag v-if="row.providerType" type="info" size="small">
              {{ row.providerType }}
            </el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>

        <el-table-column
          prop="redirectUri"
          :label="t('oauth.providers.redirectUri')"
          min-width="280"
        >
          <template #default="{ row }">
            <div v-if="row.redirectUri" class="redirect-uri-cell">
              <span class="mono-text" :title="row.redirectUri">{{ row.redirectUri }}</span>
              <el-button
                size="small"
                link
                :icon="CopyDocument"
                @click="copyToClipboard(row.redirectUri)"
              />
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>

        <el-table-column :label="t('common.actions')" width="220" fixed="right">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                type="warning"
                size="small"
                :icon="Connection"
                link
                @click="openTestLogin(row)"
              >
                {{ t('oauth.providers.testLogin.button') }}
              </el-button>
              <el-button type="primary" size="small" :icon="Edit" link @click="openEditDialog(row)">
                {{ t('common.edit') }}
              </el-button>
              <el-popconfirm
                :title="t('oauth.providers.deleteConfirm', { name: row.configName || row.name })"
                :confirm-button-text="t('common.confirm')"
                :cancel-button-text="t('common.cancel')"
                @confirm="handleDelete(row)"
              >
                <template #reference>
                  <el-button type="danger" size="small" :icon="Delete" link>
                    {{ t('common.delete') }}
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty
        v-if="!loading && providers.length === 0"
        :description="t('oauth.providers.noData')"
      />
    </el-card>

    <!-- Edit Provider Dialog -->
    <OAuthProviderForm
      v-model="currentProvider"
      v-model:visible="dialogVisible"
      @submit="handleFormSubmit"
      @cancel="dialogVisible = false"
    />

    <!-- Test Login Dialog -->
    <TestLoginDialog
      v-model:visible="testLoginDialogVisible"
      :config-id="testLoginConfig?.id || ''"
      :provider-name="testLoginConfig?.name || ''"
    />

    <!-- Create Provider Dialog -->
    <OAuthProviderCreateForm
      v-model:visible="createDialogVisible"
      @submit="handleCreateSubmit"
      @cancel="createDialogVisible = false"
    />
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
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.header-left h2 {
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.selection-info {
  font-size: 14px;
  color: #409eff;
  font-weight: 500;
}

.provider-code-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.provider-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.text-muted {
  color: #909399;
}

.redirect-uri-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.redirect-uri-cell .mono-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 240px;
}

.mono-text {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
  font-size: 12px;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

/* Table Styles */
:deep(.el-table) {
  border-radius: 8px;
  overflow: hidden;
}

:deep(.el-table th) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #1a1a2e;
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td) {
  background-color: #fafafa;
}

:deep(.el-table__row:hover > td) {
  background-color: #f5f7fa !important;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
