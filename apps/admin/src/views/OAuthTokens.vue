<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Delete, Search, Refresh, Tickets } from '@element-plus/icons-vue';
import { getOAuthTokens, deleteOAuthToken } from '@/api/oauth-token';
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

// Search & Filter
const searchClientId = ref('');
const searchUserId = ref('');

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

    const response = await getOAuthTokens(params);
    tokens.value = response.data.data;
    total.value = response.data.pagination.total;
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
    await deleteOAuthToken(id);
    ElMessage.success(t('oauth.tokens.revokeSuccess'));
    fetchTokens();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
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
        <el-button type="primary" :icon="Search" @click="handleSearch">
          {{ t('common.search') }}
        </el-button>
        <el-button :icon="Refresh" @click="handleReset">{{ t('common.reset') }}</el-button>
      </div>

      <!-- Tokens Table -->
      <el-table v-if="tokens.length > 0" :data="tokens" stripe class="tokens-table">
        <el-table-column prop="accessToken" :label="t('oauth.tokens.accessToken')" min-width="200">
          <template #default="{ row }">
            <div class="token-wrapper">
              <el-icon class="token-icon"><Tickets /></el-icon>
              <span class="token-text">{{ maskToken(row.accessToken) }}</span>
            </div>
          </template>
        </el-table-column>

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

        <el-table-column prop="scope" :label="t('oauth.tokens.scope')" min-width="120">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.scope }}</el-tag>
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
                <el-button type="danger" size="small" :icon="Delete">
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

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.search-input {
  width: 200px;
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
