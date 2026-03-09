<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Delete, Search, Refresh, Tickets, Download } from '@element-plus/icons-vue';
import { listTokens, revokeToken, batchRevokeTokens, exportTokens } from '@/api/oauth-token';
import { extractApiError } from '@/api';
import type { OAuthToken, OAuthTokenQuery } from '@/api/oauth-token';

// ============================================
// Composables
// ============================================
const { t } = useI18n();

// ============================================
// State
// ============================================
const loading = ref(false);
const tokens = ref<OAuthToken[]>([]);
const total = ref(0);
const pagination = reactive({
  limit: 10,
  offset: 0,
});

// Filters
const searchClientId = ref('');
const searchUserId = ref('');
const searchRevoked = ref<boolean | undefined>(undefined);

// Batch Operations
const selectedIds = ref<string[]>([]);
const exportLoading = ref(false);

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
async function fetchTokens() {
  loading.value = true;
  try {
    const params: OAuthTokenQuery = {
      limit: pagination.limit,
      offset: pagination.offset,
    };
    if (searchClientId.value.trim()) {
      params.clientId = searchClientId.value.trim();
    }
    if (searchUserId.value.trim()) {
      params.userId = searchUserId.value.trim();
    }
    if (searchRevoked.value !== undefined) {
      params.revoked = searchRevoked.value;
    }

    const response = await listTokens(params);
    tokens.value = response.data;
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
  fetchTokens();
}

function handleReset() {
  searchClientId.value = '';
  searchUserId.value = '';
  searchRevoked.value = undefined;
  pagination.offset = 0;
  fetchTokens();
}

function handlePageChange(page: number) {
  currentPage.value = page;
  fetchTokens();
}

function handleSizeChange(size: number) {
  pagination.limit = size;
  pagination.offset = 0;
  fetchTokens();
}

async function handleRevoke(id: string) {
  try {
    await revokeToken(id);
    ElMessage.success(t('oauth.tokens.revokeSuccess'));
    fetchTokens();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

// ============================================
// Batch Operations
// ============================================
function handleSelectionChange(selection: OAuthToken[]) {
  selectedIds.value = selection.map((t) => t.id);
}

async function handleBatchRevoke() {
  if (selectedIds.value.length === 0) return;
  if (selectedIds.value.length > 100) {
    ElMessage.warning(t('oauth.tokens.batchLimitHint'));
    return;
  }

  try {
    await ElMessageBox.confirm(
      t('oauth.tokens.batchRevokeConfirm', { count: selectedIds.value.length }),
      t('oauth.tokens.batchRevokeTitle'),
      {
        confirmButtonText: t('common.confirm'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
      }
    );

    const result = await batchRevokeTokens({ ids: selectedIds.value });

    if (result.failed.length > 0) {
      ElMessage.warning(
        t('oauth.tokens.batchRevokePartial', {
          success: result.success.length,
          failed: result.failed.length,
        })
      );
    } else {
      ElMessage.success(t('oauth.tokens.batchRevokeSuccess', { count: result.success.length }));
    }

    selectedIds.value = [];
    fetchTokens();
  } catch (error: unknown) {
    if (error !== 'cancel') {
      const apiError = extractApiError(error);
      ElMessage.error(apiError.displayMessage);
    }
  }
}

async function handleExport() {
  exportLoading.value = true;
  try {
    const params: OAuthTokenQuery = {};
    if (searchClientId.value.trim()) {
      params.clientId = searchClientId.value.trim();
    }
    if (searchUserId.value.trim()) {
      params.userId = searchUserId.value.trim();
    }
    if (searchRevoked.value !== undefined) {
      params.revoked = searchRevoked.value;
    }

    await exportTokens(params);
    ElMessage.success(t('oauth.tokens.exportSuccess'));
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    exportLoading.value = false;
  }
}

// ============================================
// Utility Functions
// ============================================
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
}

function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

function getExpiresStatus(expiresAt: string): 'success' | 'warning' | 'danger' {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffHours = (expires.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0) return 'danger';
  if (diffHours < 24) return 'warning';
  return 'success';
}

function maskToken(token: string): string {
  if (token.length <= 20) return token;
  return `${token.substring(0, 10)}...${token.substring(token.length - 10)}`;
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchTokens();
});
</script>

<template>
  <div class="oauth-tokens-page">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <h2>{{ t('oauth.tokens.title') }}</h2>
          <div class="header-actions">
            <el-button :icon="Download" :loading="exportLoading" @click="handleExport">
              {{ t('oauth.tokens.export') }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- Search & Filter Bar -->
      <div class="search-bar">
        <el-input
          v-model="searchClientId"
          :placeholder="t('oauth.tokens.clientId')"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-input
          v-model="searchUserId"
          :placeholder="t('oauth.tokens.userId')"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select
          v-model="searchRevoked"
          :placeholder="t('oauth.tokens.revokedStatus')"
          clearable
          class="search-input"
        >
          <el-option :label="t('oauth.tokens.all')" :value="undefined" />
          <el-option :label="t('oauth.tokens.active')" :value="false" />
          <el-option :label="t('oauth.tokens.revoked')" :value="true" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">
          {{ t('common.search') }}
        </el-button>
        <el-button :icon="Refresh" @click="handleReset">{{ t('common.reset') }}</el-button>
      </div>

      <!-- Batch Actions Bar -->
      <div v-if="selectedIds.length > 0" class="batch-actions-bar">
        <span class="selected-count">{{
          t('oauth.tokens.selectedCount', { count: selectedIds.length })
        }}</span>
        <el-button
          type="danger"
          :icon="Delete"
          :disabled="selectedIds.length > 100"
          @click="handleBatchRevoke"
        >
          {{ t('oauth.tokens.batchRevoke') }}
        </el-button>
        <span v-if="selectedIds.length > 100" class="batch-limit-hint">
          {{ t('oauth.tokens.batchLimitHint') }}
        </span>
      </div>

      <!-- Tokens Table -->
      <el-table
        v-if="tokens.length > 0"
        :data="tokens"
        stripe
        class="tokens-table"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="clientId" :label="t('oauth.tokens.clientId')" min-width="180">
          <template #default="{ row }">
            <span class="client-id">{{ row.clientId }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="userId" :label="t('oauth.tokens.userId')" min-width="180">
          <template #default="{ row }">
            <span v-if="row.userId" class="user-id">{{ row.userId }}</span>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="accessToken" :label="t('oauth.tokens.accessToken')" min-width="200">
          <template #default="{ row }">
            <div class="token-wrapper">
              <el-icon class="token-icon"><Tickets /></el-icon>
              <span class="token-text">{{ maskToken(row.accessToken) }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="scopes" :label="t('oauth.tokens.scopes')" min-width="150">
          <template #default="{ row }">
            <div class="scopes-wrapper">
              <el-tag
                v-for="scope in row.scopes"
                :key="scope"
                size="small"
                type="info"
                class="scope-tag"
              >
                {{ scope }}
              </el-tag>
              <span v-if="!row.scopes || row.scopes.length === 0" class="no-data">-</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="expiresAt" :label="t('oauth.tokens.expiresAt')" min-width="160">
          <template #default="{ row }">
            <div class="expires-wrapper">
              <el-tag :type="getExpiresStatus(row.expiresAt)" size="small">
                {{ formatDate(row.expiresAt) }}
              </el-tag>
              <span v-if="isTokenExpired(row.expiresAt)" class="expired-badge">
                {{ t('oauth.tokens.expired') }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="revokedAt" :label="t('oauth.tokens.revokedAt')" min-width="160">
          <template #default="{ row }">
            <el-tag v-if="row.revokedAt" type="danger" size="small">
              {{ formatDate(row.revokedAt) }}
            </el-tag>
            <el-tag v-else type="success" size="small">
              {{ t('oauth.tokens.active') }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" :label="t('oauth.tokens.createdAt')" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column :label="t('common.actions')" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-popconfirm
              :title="t('oauth.tokens.revokeConfirm')"
              :confirm-button-text="t('common.confirm')"
              :cancel-button-text="t('common.cancel')"
              @confirm="handleRevoke(row.id)"
            >
              <template #reference>
                <el-button type="danger" size="small" :icon="Delete" :disabled="!!row.revokedAt">
                  {{ t('oauth.tokens.revoke') }}
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty v-else :description="t('oauth.tokens.noData')" />

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
  </div>
</template>

<style scoped>
.oauth-tokens-page {
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

.header-actions {
  display: flex;
  gap: 12px;
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  width: 180px;
}

.batch-actions-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 20px;
  background-color: #f0f9ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
}

.selected-count {
  font-weight: 500;
  color: #1e40af;
}

.batch-limit-hint {
  font-size: 12px;
  color: #dc2626;
}

.tokens-table {
  width: 100%;
}

.tokens-table :deep(.el-table__header th) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #1a1a2e;
}

.tokens-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.tokens-table :deep(.el-table__row:hover > td) {
  background-color: #f5f7fa !important;
}

.token-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.token-icon {
  color: #667eea;
  font-size: 16px;
}

.token-text {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #606266;
}

.client-id,
.user-id {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #606266;
}

.no-data {
  color: #c0c4cc;
}

.scopes-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.scope-tag {
  margin: 0;
}

.expires-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expired-badge {
  font-size: 12px;
  color: #f56c6c;
  font-weight: 500;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
