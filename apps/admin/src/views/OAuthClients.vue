<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import {
  Plus,
  Edit,
  Delete,
  Search,
  Refresh,
  Key,
  CopyDocument,
  Lock,
  Unlock,
} from '@element-plus/icons-vue';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  regenerateSecret,
} from '@/api/oauth';
import { extractApiError } from '@/api';
import type {
  OAuthClient,
  CreateOAuthClientDto,
  UpdateOAuthClientDto,
  OAuthClientQuery,
} from '@/api/oauth';
import OAuthClientForm from '@/components/OAuthClientForm.vue';

// ============================================
// Composables
// ============================================
const { t } = useI18n();

// ============================================
// State
// ============================================
const loading = ref(false);
const clients = ref<OAuthClient[]>([]);
const total = ref(0);
const pagination = reactive({
  limit: 10,
  offset: 0,
});

// Search
const searchKeyword = ref('');

// Dialog
const dialogVisible = ref(false);
const editingClient = ref<OAuthClient | null>(null);
const formLoading = ref(false);

// Regenerate Secret Dialog
const secretDialogVisible = ref(false);
const regeneratedSecret = ref('');
const regeneratingClientId = ref<string | null>(null);

// ============================================
// Computed
// ============================================
const currentPage = computed({
  get: () => Math.floor(pagination.offset / pagination.limit) + 1,
  set: (val: number) => {
    pagination.offset = (val - 1) * pagination.limit;
  },
});

// ============================================
// CRUD Functions
// ============================================
async function fetchClients() {
  loading.value = true;
  try {
    const params: OAuthClientQuery = {
      limit: pagination.limit,
      offset: pagination.offset,
    };
    if (searchKeyword.value.trim()) {
      params.keyword = searchKeyword.value.trim();
    }

    const response = await listClients(params);
    clients.value = response.data;
    total.value = response.total;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.offset = 0;
  fetchClients();
}

function handleReset() {
  searchKeyword.value = '';
  pagination.offset = 0;
  fetchClients();
}

function handlePageChange(page: number) {
  currentPage.value = page;
  fetchClients();
}

function handleSizeChange(size: number) {
  pagination.limit = size;
  pagination.offset = 0;
  fetchClients();
}

function openCreateDialog() {
  editingClient.value = null;
  dialogVisible.value = true;
}

function openEditDialog(client: OAuthClient) {
  editingClient.value = client;
  dialogVisible.value = true;
}

async function handleFormSubmit(data: CreateOAuthClientDto) {
  formLoading.value = true;
  try {
    if (editingClient.value) {
      const updateData: UpdateOAuthClientDto = {
        name: data.name,
        redirectUris: data.redirectUris,
        scopes: data.scopes,
        isConfidential: data.isConfidential,
      };
      await updateClient(editingClient.value.id, updateData);
      ElMessage.success(t('oauth.clients.updateSuccess'));
    } else {
      const newClient = await createClient(data);
      ElMessage.success(t('oauth.clients.createSuccess'));
      // Show the new secret one-time
      if (newClient.clientSecret) {
        regeneratedSecret.value = newClient.clientSecret;
        regeneratingClientId.value = newClient.id;
        secretDialogVisible.value = true;
      }
    }
    dialogVisible.value = false;
    fetchClients();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    formLoading.value = false;
  }
}

async function handleDelete(id: string) {
  try {
    await deleteClient(id);
    ElMessage.success(t('oauth.clients.deleteSuccess'));
    fetchClients();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    // Check for active tokens error
    if (apiError.message.includes('active tokens') || apiError.statusCode === 400) {
      ElMessage.error(t('oauth.clients.hasActiveTokens'));
    } else {
      ElMessage.error(apiError.displayMessage);
    }
  }
}

async function handleRegenerateSecret(client: OAuthClient) {
  regeneratingClientId.value = client.id;
  try {
    const response = await regenerateSecret(client.id);
    regeneratedSecret.value = response.clientSecret;
    secretDialogVisible.value = true;
    ElMessage.success(t('oauth.clients.regenerateSecretSuccess'));
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

function copySecretToClipboard() {
  navigator.clipboard
    .writeText(regeneratedSecret.value)
    .then(() => {
      ElMessage.success(t('twoFactor.codesCopied'));
    })
    .catch(() => {
      ElMessage.error(t('twoFactor.copyFailed'));
    });
}

function closeSecretDialog() {
  secretDialogVisible.value = false;
  regeneratedSecret.value = '';
  regeneratingClientId.value = null;
}

// ============================================
// Utility Functions
// ============================================
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
}

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      ElMessage.success(t('twoFactor.codesCopied'));
    })
    .catch(() => {
      ElMessage.error(t('twoFactor.copyFailed'));
    });
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchClients();
});
</script>

<template>
  <div class="oauth-clients-page">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <h2>{{ t('oauth.clients.title') }}</h2>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">
            {{ t('oauth.clients.create') }}
          </el-button>
        </div>
      </template>

      <!-- Search Bar -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          :placeholder="t('policies.searchPlaceholder')"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" :icon="Search" @click="handleSearch">
          {{ t('common.search') }}
        </el-button>
        <el-button :icon="Refresh" @click="handleReset">{{ t('common.reset') }}</el-button>
      </div>

      <!-- Clients Table -->
      <el-table v-if="clients.length > 0" :data="clients" stripe class="clients-table">
        <el-table-column prop="name" :label="t('oauth.clients.name')" min-width="150">
          <template #default="{ row }">
            <div class="client-name">
              <el-icon class="client-icon"><Key /></el-icon>
              <span class="name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="clientId" :label="t('oauth.clients.clientId')" min-width="200">
          <template #default="{ row }">
            <div class="client-id-wrapper">
              <span class="client-id">{{ row.clientId }}</span>
              <el-button size="small" text @click="copyToClipboard(row.clientId)">
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="redirectUris"
          :label="t('oauth.clients.redirectUris')"
          min-width="200"
        >
          <template #default="{ row }">
            <div class="redirect-uris">
              <el-tag
                v-for="(uri, index) in row.redirectUris.slice(0, 2)"
                :key="index"
                size="small"
                class="uri-tag"
              >
                {{ uri }}
              </el-tag>
              <el-tag v-if="row.redirectUris.length > 2" size="small" type="info" class="uri-tag">
                +{{ row.redirectUris.length - 2 }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="allowedScopes" :label="t('oauth.clients.scope')" min-width="120">
          <template #default="{ row }">
            <div v-if="row.allowedScopes && row.allowedScopes.length > 0" class="scope-tags">
              <el-tag
                v-for="scope in row.allowedScopes.slice(0, 3)"
                :key="scope"
                size="small"
                type="info"
                class="scope-tag"
              >
                {{ scope }}
              </el-tag>
              <el-tag
                v-if="row.allowedScopes.length > 3"
                size="small"
                type="info"
                class="scope-tag"
              >
                +{{ row.allowedScopes.length - 3 }}
              </el-tag>
            </div>
            <span v-else class="no-scopes">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="isConfidential" label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tooltip :content="row.isConfidential ? '机密客户端' : '公开客户端'" placement="top">
              <el-icon v-if="row.isConfidential" class="confidential-icon"><Lock /></el-icon>
              <el-icon v-else class="public-icon"><Unlock /></el-icon>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column :label="t('oauth.clients.createdAt')" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column :label="t('common.actions')" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" :icon="Edit" @click="openEditDialog(row)">
                {{ t('common.edit') }}
              </el-button>
              <el-popconfirm
                :title="t('oauth.clients.regenerateSecretConfirm')"
                :confirm-button-text="t('common.confirm')"
                :cancel-button-text="t('common.cancel')"
                @confirm="handleRegenerateSecret(row)"
              >
                <template #reference>
                  <el-button type="warning" size="small" :icon="Key">
                    {{ t('oauth.clients.regenerateSecret') }}
                  </el-button>
                </template>
              </el-popconfirm>
              <el-popconfirm
                :title="t('oauth.clients.deleteConfirm')"
                :confirm-button-text="t('common.confirm')"
                :cancel-button-text="t('common.cancel')"
                @confirm="handleDelete(row.id)"
              >
                <template #reference>
                  <el-button type="danger" size="small" :icon="Delete">
                    {{ t('common.delete') }}
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty v-else :description="t('oauth.clients.noData')">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          {{ t('oauth.clients.create') }}
        </el-button>
      </el-empty>

      <!-- Pagination -->
      <div v-if="total > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- Create/Edit Dialog -->
    <OAuthClientForm
      v-model:visible="dialogVisible"
      :model-value="editingClient"
      :loading="formLoading"
      @submit="handleFormSubmit"
      @cancel="dialogVisible = false"
    />

    <!-- Regenerated Secret Dialog (One-time display) -->
    <el-dialog
      v-model="secretDialogVisible"
      :title="t('oauth.clients.newClientSecret')"
      width="500px"
      :close-on-click-modal="false"
      @close="closeSecretDialog"
    >
      <el-alert
        :title="t('oauth.clients.regenerateSecretWarning')"
        type="warning"
        :closable="false"
        show-icon
        class="secret-warning"
      />

      <div class="secret-display">
        <el-input :model-value="regeneratedSecret" readonly class="secret-input">
          <template #append>
            <el-button :icon="CopyDocument" @click="copySecretToClipboard"> 复制 </el-button>
          </template>
        </el-input>
      </div>

      <div class="secret-hint">
        {{ t('oauth.clients.secretHidden') }}
      </div>

      <template #footer>
        <el-button type="primary" @click="closeSecretDialog">
          {{ t('common.confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.oauth-clients-page {
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
  align-items: center;
}

.card-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  width: 280px;
}

.clients-table {
  width: 100%;
}

.clients-table :deep(.el-table__header th) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #1a1a2e;
}

.clients-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.clients-table :deep(.el-table__row:hover > td) {
  background-color: #f5f7fa !important;
}

.client-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.client-icon {
  color: #667eea;
  font-size: 16px;
}

.name-text {
  font-weight: 500;
  color: #1a1a2e;
}

.client-id-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.client-id {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #606266;
}

.redirect-uris {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.uri-tag {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.scope-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.scope-tag {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-scopes {
  color: #c0c4cc;
}

.confidential-icon {
  color: #e6a23c;
  font-size: 18px;
}

.public-icon {
  color: #67c23a;
  font-size: 18px;
}

.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-buttons .el-button {
  border-radius: 6px;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

/* Secret Dialog Styles */
.secret-warning {
  margin-bottom: 20px;
}

.secret-display {
  margin-bottom: 16px;
}

.secret-input {
  font-family: 'Courier New', monospace;
}

.secret-input :deep(.el-input__inner) {
  font-family: 'Courier New', monospace;
  font-size: 14px;
}

.secret-hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
