<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus,
  Edit,
  Delete,
  Search,
  Refresh,
  Key,
  InfoFilled,
  RefreshRight,
} from '@element-plus/icons-vue';
import {
  getOAuthClients,
  createOAuthClient,
  updateOAuthClient,
  deleteOAuthClient,
  regenerateClientSecret,
} from '@/api/oauth';
import { extractApiError } from '@/api';
import type { OAuthClient, CreateOAuthClientDto, OAuthClientQuery } from '@/api/oauth';
import OAuthClientForm from '@/components/OAuthClientForm.vue';

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
const regenerateDialogVisible = ref(false);
const regeneratingClient = ref<OAuthClient | null>(null);
const newClientSecret = ref('');

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

    const response = await getOAuthClients(params);
    clients.value = response.data.data;
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
      await updateOAuthClient(editingClient.value.id, data);
      ElMessage.success('OAuth客户端更新成功');
    } else {
      await createOAuthClient(data);
      ElMessage.success('OAuth客户端创建成功');
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
    await deleteOAuthClient(id);
    ElMessage.success('OAuth客户端删除成功');
    fetchClients();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    if (apiError.statusCode === 400 && apiError.message.includes('active tokens')) {
      ElMessage.error('该客户端存在活跃的 Token，请先撤销所有 Token 后再删除');
    } else {
      ElMessage.error(apiError.displayMessage);
    }
  }
}

async function openRegenerateSecretDialog(client: OAuthClient) {
  try {
    await ElMessageBox.confirm('重新生成 Secret 后，旧的 Secret 将立即失效。确定继续？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    });

    regeneratingClient.value = client;
    regenerateDialogVisible.value = true;
    newClientSecret.value = '';
  } catch {
    // 用户取消
  }
}

async function handleRegenerateSecret() {
  if (!regeneratingClient.value) return;

  formLoading.value = true;
  try {
    const response = await regenerateClientSecret(regeneratingClient.value.id);
    newClientSecret.value = response.data.clientSecret;
    ElMessage.success('Secret 重新生成成功，请立即保存');
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    formLoading.value = false;
  }
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
      ElMessage.success('已复制到剪贴板');
    })
    .catch(() => {
      ElMessage.error('复制失败');
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
          <h2>OAuth客户端管理</h2>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog"> 新建客户端 </el-button>
        </div>
      </template>

      <!-- Search Bar -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索客户端名称或ID"
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

      <!-- Clients Table -->
      <el-table v-if="clients.length > 0" :data="clients" stripe class="clients-table">
        <el-table-column prop="name" label="客户端名称" min-width="150">
          <template #default="{ row }">
            <div class="client-name">
              <el-icon class="client-icon"><Key /></el-icon>
              <span class="name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="clientId" label="Client ID" min-width="200">
          <template #default="{ row }">
            <div class="client-id-wrapper">
              <span class="client-id">{{ row.clientId }}</span>
              <el-button size="small" text @click="copyToClipboard(row.clientId)"> 复制 </el-button>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="clientSecret" label="Client Secret" min-width="150">
          <template #default>
            <span class="client-secret">••••••••</span>
            <el-tooltip
              content="Client Secret 已加密存储，仅在创建和重新生成时显示明文"
              placement="top"
            >
              <el-icon class="info-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </template>
        </el-table-column>

        <el-table-column prop="redirectUris" label="回调地址" min-width="200">
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

        <el-table-column prop="scope" label="权限范围" min-width="120">
          <template #default="{ row }">
            <el-tag size="small" type="info">{{ row.scope }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="isActive" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
              {{ row.isActive ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="280" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" :icon="Edit" @click="openEditDialog(row)">
                编辑
              </el-button>
              <el-button
                type="warning"
                size="small"
                :icon="RefreshRight"
                @click="openRegenerateSecretDialog(row)"
              >
                重新生成 Secret
              </el-button>
              <el-popconfirm
                title="确定要删除该OAuth客户端吗？"
                confirm-button-text="确定"
                cancel-button-text="取消"
                @confirm="handleDelete(row.id)"
              >
                <template #reference>
                  <el-button type="danger" size="small" :icon="Delete"> 删除 </el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty v-else description="暂无OAuth客户端">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          创建第一个客户端
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
      :client="editingClient"
      :loading="formLoading"
      @submit="handleFormSubmit"
    />

    <!-- Regenerate Secret Dialog -->
    <el-dialog
      v-model="regenerateDialogVisible"
      title="重新生成 Client Secret"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-alert
        v-if="newClientSecret"
        title="请立即保存新的 Client Secret，关闭对话框后将无法再次查看"
        type="warning"
        :closable="false"
        show-icon
        class="secret-alert"
      />

      <div v-if="newClientSecret" class="secret-display">
        <label>新的 Client Secret:</label>
        <div class="secret-value">
          <code>{{ newClientSecret }}</code>
          <el-button size="small" @click="copyToClipboard(newClientSecret)"> 复制 </el-button>
        </div>
      </div>

      <div v-else class="regenerate-info">
        <p>
          将重新生成 <strong>{{ regeneratingClient?.name }}</strong> 的 Client Secret。
        </p>
        <p>旧的 Secret 将立即失效，请确保已更新所有使用该 Secret 的应用。</p>
      </div>

      <template #footer>
        <el-button @click="regenerateDialogVisible = false">关闭</el-button>
        <el-button
          v-if="!newClientSecret"
          type="primary"
          :loading="formLoading"
          @click="handleRegenerateSecret"
        >
          重新生成
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
  gap: 8px;
}

.client-id {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #606266;
}

.client-secret {
  font-family: 'Courier New', monospace;
  font-size: 12px;
  color: #909399;
  letter-spacing: 2px;
}

.info-icon {
  margin-left: 8px;
  color: #909399;
  cursor: help;
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

.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.action-buttons .el-button {
  border-radius: 6px;
}

.action-buttons .el-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.action-buttons .el-button--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.action-buttons .el-button--danger {
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.action-buttons .el-button--danger:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.4);
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

/* Regenerate Secret Dialog */
.secret-alert {
  margin-bottom: 20px;
}

.secret-display {
  padding: 16px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.secret-display label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  color: #606266;
}

.secret-value {
  display: flex;
  align-items: center;
  gap: 12px;
}

.secret-value code {
  flex: 1;
  padding: 8px 12px;
  background-color: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #303133;
  word-break: break-all;
}

.regenerate-info {
  line-height: 1.8;
  color: #606266;
}
</style>
