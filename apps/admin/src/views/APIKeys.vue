<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Delete, Search, Refresh, Key, CopyDocument } from '@element-plus/icons-vue';
import { getApiKeys, createApiKey, deleteApiKey } from '@/api/api-key';
import { extractApiError } from '@/api';
import type { ApiKey, CreateApiKeyDto, ApiKeyQuery } from '@/api/api-key';

// ============================================
// State
// ============================================
const loading = ref(false);
const apiKeys = ref<ApiKey[]>([]);
const total = ref(0);
const pagination = reactive({
  limit: 10,
  offset: 0,
});

// Search
const searchUserId = ref('');
const searchKeyword = ref('');

// Create Dialog
const dialogVisible = ref(false);
const formLoading = ref(false);
const createForm = ref<CreateApiKeyDto>({
  name: '',
  permissions: [],
  expiresAt: undefined,
});

// Newly created key display
const newKeyDialogVisible = ref(false);
const newlyCreatedKey = ref('');

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
async function fetchApiKeys() {
  loading.value = true;
  try {
    const params: ApiKeyQuery = {
      limit: pagination.limit,
      offset: pagination.offset,
    };
    if (searchUserId.value.trim()) {
      params.userId = searchUserId.value.trim();
    }
    if (searchKeyword.value.trim()) {
      params.keyword = searchKeyword.value.trim();
    }

    const response = await getApiKeys(params);
    apiKeys.value = response.data.data;
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
  fetchApiKeys();
}

function handleReset() {
  searchUserId.value = '';
  searchKeyword.value = '';
  pagination.offset = 0;
  fetchApiKeys();
}

function handlePageChange(page: number) {
  currentPage.value = page;
  fetchApiKeys();
}

function handleSizeChange(size: number) {
  pagination.limit = size;
  pagination.offset = 0;
  fetchApiKeys();
}

function openCreateDialog() {
  createForm.value = {
    name: '',
    permissions: [],
    expiresAt: undefined,
  };
  dialogVisible.value = true;
}

async function handleCreate() {
  if (!createForm.value.name.trim()) {
    ElMessage.warning('请输入API密钥名称');
    return;
  }

  formLoading.value = true;
  try {
    const response = await createApiKey(createForm.value);
    dialogVisible.value = false;

    // Show the newly created key
    if (response.data.key) {
      newlyCreatedKey.value = response.data.key;
      newKeyDialogVisible.value = true;
    }

    ElMessage.success('API密钥创建成功');
    fetchApiKeys();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    formLoading.value = false;
  }
}

async function handleDelete(id: string) {
  try {
    await deleteApiKey(id);
    ElMessage.success('API密钥已撤销');
    fetchApiKeys();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

// ============================================
// Utility Functions
// ============================================
function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
}

function copyToClipboard(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      ElMessage.success('已复制到剪贴板');
    })
    .catch(() => {
      ElMessage.error('复制失败');
    });
}

function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

function getExpiresStatus(expiresAt: string | undefined): '' | 'success' | 'warning' | 'danger' {
  if (!expiresAt) return 'success';

  const now = new Date();
  const expires = new Date(expiresAt);
  const diffDays = (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays < 0) return 'danger';
  if (diffDays < 7) return 'warning';
  return 'success';
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchApiKeys();
});
</script>

<template>
  <div class="api-keys-page">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <h2>API密钥管理</h2>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog"> 创建密钥 </el-button>
        </div>
      </template>

      <!-- Search Bar -->
      <div class="search-bar">
        <el-input
          v-model="searchUserId"
          placeholder="用户ID"
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
          placeholder="搜索密钥名称"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" :icon="Search" @click="handleSearch"> 搜索 </el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- API Keys Table -->
      <el-table v-if="apiKeys.length > 0" :data="apiKeys" stripe class="keys-table">
        <el-table-column prop="name" label="密钥名称" min-width="150">
          <template #default="{ row }">
            <div class="key-name">
              <el-icon class="key-icon"><Key /></el-icon>
              <span class="name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="key" label="密钥" min-width="200">
          <template #default="{ row }">
            <div v-if="row.key" class="key-wrapper">
              <span class="key-text">{{ row.key }}</span>
              <el-button size="small" text @click="copyToClipboard(row.key)">
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </div>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="userId" label="用户ID" min-width="180">
          <template #default="{ row }">
            <span class="user-id">{{ row.userId }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="permissions" label="权限" min-width="150">
          <template #default="{ row }">
            <div v-if="row.permissions && row.permissions.length > 0" class="permissions-wrapper">
              <el-tag
                v-for="(permission, index) in row.permissions.slice(0, 2)"
                :key="index"
                size="small"
                class="permission-tag"
              >
                {{ permission }}
              </el-tag>
              <el-tag
                v-if="row.permissions.length > 2"
                size="small"
                type="info"
                class="permission-tag"
              >
                +{{ row.permissions.length - 2 }}
              </el-tag>
            </div>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="isActive" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
              {{ row.isActive ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="expiresAt" label="过期时间" min-width="160">
          <template #default="{ row }">
            <div class="expires-wrapper">
              <el-tag :type="getExpiresStatus(row.expiresAt)" size="small">
                {{ formatDate(row.expiresAt) }}
              </el-tag>
              <span v-if="isExpired(row.expiresAt)" class="expired-badge"> 已过期 </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="lastUsedAt" label="最后使用" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.lastUsedAt) }}
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" label="创建时间" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="120" fixed="right" align="center">
          <template #default="{ row }">
            <el-popconfirm
              title="确定要撤销该API密钥吗？"
              confirm-button-text="确定"
              cancel-button-text="取消"
              @confirm="handleDelete(row.id)"
            >
              <template #reference>
                <el-button type="danger" size="small" :icon="Delete"> 撤销 </el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty v-else description="暂无API密钥">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          创建第一个密钥
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

    <!-- Create Dialog -->
    <el-dialog
      v-model="dialogVisible"
      title="创建API密钥"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px" label-position="top">
        <el-form-item label="密钥名称" required>
          <el-input
            v-model="createForm.name"
            placeholder="请输入密钥名称"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="权限">
          <el-select
            v-model="createForm.permissions"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入权限"
            class="full-width"
          >
            <el-option label="读取用户信息" value="user:read" />
            <el-option label="写入用户信息" value="user:write" />
            <el-option label="读取角色" value="role:read" />
            <el-option label="写入角色" value="role:write" />
          </el-select>
        </el-form-item>

        <el-form-item label="过期时间">
          <el-date-picker
            v-model="createForm.expiresAt"
            type="datetime"
            placeholder="选择过期时间（可选）"
            class="full-width"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formLoading" @click="handleCreate"> 创建 </el-button>
      </template>
    </el-dialog>

    <!-- New Key Display Dialog -->
    <el-dialog
      v-model="newKeyDialogVisible"
      title="API密钥已创建"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-alert
        title="请立即保存您的API密钥！"
        type="warning"
        :closable="false"
        show-icon
        class="key-alert"
      >
        <p>此密钥仅会显示一次。关闭此对话框后将无法再次查看完整密钥。</p>
      </el-alert>

      <div class="new-key-display">
        <el-input :model-value="newlyCreatedKey" readonly class="key-input">
          <template #append>
            <el-button :icon="CopyDocument" @click="copyToClipboard(newlyCreatedKey)">
              复制
            </el-button>
          </template>
        </el-input>
      </div>

      <template #footer>
        <el-button type="primary" @click="newKeyDialogVisible = false"> 我已保存 </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.api-keys-page {
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

.keys-table {
  width: 100%;
}

.keys-table :deep(.el-table__header th) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #1a1a2e;
}

.keys-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.keys-table :deep(.el-table__row:hover > td) {
  background-color: #f5f7fa !important;
}

.key-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.key-icon {
  color: #667eea;
  font-size: 16px;
}

.name-text {
  font-weight: 500;
  color: #1a1a2e;
}

.key-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
}

.key-text {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #606266;
}

.user-id {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #606266;
}

.no-data {
  color: #c0c4cc;
}

.permissions-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.permission-tag {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.full-width {
  width: 100%;
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

.key-alert {
  margin-bottom: 20px;
}

.key-alert p {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: #606266;
}

.new-key-display {
  margin-top: 20px;
}

.key-input {
  font-family: 'Courier New', monospace;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
