<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Delete, Search, Refresh, Link, User } from '@element-plus/icons-vue';
import { getSocialAccounts, deleteSocialAccount } from '@/api/social-account';
import { extractApiError } from '@/api';
import type { SocialAccount, SocialAccountQuery } from '@/api/social-account';

// ============================================
// i18n
// ============================================
const { t } = useI18n();

// ============================================
// State
// ============================================
const loading = ref(false);
const accounts = ref<SocialAccount[]>([]);
const total = ref(0);
const pagination = reactive({
  limit: 10,
  offset: 0,
});

// Search & Filter
const searchProvider = ref('');
const searchUserId = ref('');
const searchKeyword = ref('');

// Provider options with i18n
const providerOptions = computed(() => [
  { label: t('oauth.socialAccounts.providers.wechat'), value: 'wechat' },
  { label: t('oauth.socialAccounts.providers.dingtalk'), value: 'dingtalk' },
  { label: t('oauth.socialAccounts.providers.qq'), value: 'qq' },
  { label: t('oauth.socialAccounts.providers.weibo'), value: 'weibo' },
  { label: t('oauth.socialAccounts.providers.feishu'), value: 'feishu' },
  { label: t('oauth.socialAccounts.providers.baidu'), value: 'baidu' },
]);

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
async function fetchAccounts() {
  loading.value = true;
  try {
    const params: SocialAccountQuery = {
      limit: pagination.limit,
      offset: pagination.offset,
    };
    if (searchProvider.value) {
      params.provider = searchProvider.value;
    }
    if (searchUserId.value.trim()) {
      params.userId = searchUserId.value.trim();
    }
    if (searchKeyword.value.trim()) {
      params.keyword = searchKeyword.value.trim();
    }

    const response = await getSocialAccounts(params);
    accounts.value = response.data.data;
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
  fetchAccounts();
}

function handleReset() {
  searchProvider.value = '';
  searchUserId.value = '';
  searchKeyword.value = '';
  pagination.offset = 0;
  fetchAccounts();
}

function handlePageChange(page: number) {
  currentPage.value = page;
  fetchAccounts();
}

function handleSizeChange(size: number) {
  pagination.limit = size;
  pagination.offset = 0;
  fetchAccounts();
}

async function handleUnlink(id: string) {
  try {
    await deleteSocialAccount(id);
    ElMessage.success(t('oauth.socialAccounts.unlinkSuccess'));
    fetchAccounts();
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

function getProviderLabel(provider: string): string {
  const option = providerOptions.value.find((opt) => opt.value === provider);
  return option ? option.label : provider;
}

function getProviderColor(provider: string): string {
  const colorMap: Record<string, string> = {
    wechat: '#07c160',
    dingtalk: '#0089ff',
    qq: '#12b7f5',
    weibo: '#e6162d',
    feishu: '#00d6b9',
    baidu: '#2932e1',
  };
  return colorMap[provider] || '#909399';
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchAccounts();
});
</script>

<template>
  <div class="social-accounts-page">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <h2>{{ t('oauth.socialAccounts.title') }}</h2>
        </div>
      </template>

      <!-- Search & Filter Bar -->
      <div class="search-bar">
        <el-select
          v-model="searchProvider"
          :placeholder="t('oauth.socialAccounts.filterProvider')"
          clearable
          class="search-select"
        >
          <el-option
            v-for="option in providerOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-input
          v-model="searchUserId"
          :placeholder="t('oauth.socialAccounts.userId')"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-input
          v-model="searchKeyword"
          :placeholder="t('oauth.socialAccounts.searchPlaceholder')"
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

      <!-- Accounts Table -->
      <el-table v-if="accounts.length > 0" :data="accounts" stripe class="accounts-table">
        <el-table-column prop="userId" :label="t('oauth.socialAccounts.userId')" min-width="180">
          <template #default="{ row }">
            <div class="user-cell">
              <el-avatar v-if="row.avatarUrl" :src="row.avatarUrl" :size="32" class="user-avatar" />
              <el-avatar v-else :size="32" class="user-avatar-placeholder">
                <el-icon><User /></el-icon>
              </el-avatar>
              <div class="user-info">
                <span class="user-id">{{ row.userId }}</span>
                <span v-if="row.username" class="user-name">{{ row.username }}</span>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="provider"
          :label="t('oauth.socialAccounts.provider')"
          min-width="120"
        >
          <template #default="{ row }">
            <el-tag
              :style="{
                backgroundColor: getProviderColor(row.provider),
                borderColor: getProviderColor(row.provider),
                color: '#fff',
              }"
              size="small"
            >
              {{ getProviderLabel(row.provider) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column
          prop="providerUserId"
          :label="t('oauth.socialAccounts.providerUserId')"
          min-width="180"
        >
          <template #default="{ row }">
            <div class="provider-user-id-wrapper">
              <el-icon class="link-icon"><Link /></el-icon>
              <span class="provider-user-id">{{ row.providerUserId }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="email" :label="t('oauth.socialAccounts.email')" min-width="180">
          <template #default="{ row }">
            <span v-if="row.email">{{ row.email }}</span>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>

        <el-table-column
          prop="createdAt"
          :label="t('oauth.socialAccounts.createdAt')"
          min-width="160"
        >
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column :label="t('common.delete')" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-popconfirm
              :title="t('oauth.socialAccounts.unlinkConfirm')"
              :confirm-button-text="t('common.confirm')"
              :cancel-button-text="t('common.cancel')"
              @confirm="handleUnlink(row.id)"
            >
              <template #reference>
                <el-button type="danger" size="small" :icon="Delete">
                  {{ t('oauth.socialAccounts.unlink') }}
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty v-else :description="t('oauth.socialAccounts.empty')" />

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
.social-accounts-page {
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

.search-select {
  width: 140px;
}

.search-input {
  width: 200px;
}

.accounts-table {
  width: 100%;
}

.accounts-table :deep(.el-table__header th) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #1a1a2e;
}

.accounts-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.accounts-table :deep(.el-table__row:hover > td) {
  background-color: #f5f7fa !important;
}

/* User Cell Styles */
.user-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  flex-shrink: 0;
}

.user-avatar-placeholder {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.user-id {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #606266;
}

.user-name {
  font-size: 12px;
  color: #909399;
}

.no-data {
  color: #c0c4cc;
}

.provider-user-id-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.link-icon {
  color: #667eea;
  font-size: 16px;
}

.provider-user-id {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #606266;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

/* Action Button Styles */
:deep(.el-button--danger) {
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

:deep(.el-button--danger:hover) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.4);
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
