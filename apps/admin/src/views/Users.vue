<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Edit, Delete, User, Search, Refresh } from '@element-plus/icons-vue';
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  updateUserStatus,
} from '@/api/admin-user';
import { extractApiError } from '@/api';
import type {
  AdminUserResponse,
  CreateAdminUserDto,
  UpdateAdminUserDto,
  UserQueryParams,
} from '@/types/user';
import type { UserStatus } from '@/types/auth';

// ============================================
// State
// ============================================
const loading = ref(false);
const users = ref<AdminUserResponse[]>([]);
const total = ref(0);
const pagination = reactive({
  limit: 10,
  offset: 0,
});

// Search and filter
const searchKeyword = ref('');
const filterStatus = ref<UserStatus | ''>('');

// User form dialog
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const userFormRef = ref();
const userForm = reactive<CreateAdminUserDto & { id?: string }>({
  username: '',
  password: '',
  email: '',
  phone: '',
  nickname: '',
  status: 'active',
});
const formLoading = ref(false);

// ============================================
// Computed
// ============================================
const dialogTitle = computed(() => (dialogMode.value === 'create' ? '新增用户' : '编辑用户'));

const currentPage = computed({
  get: () => Math.floor(pagination.offset / pagination.limit) + 1,
  set: (val: number) => {
    pagination.offset = (val - 1) * pagination.limit;
  },
});

// ============================================
// User CRUD Functions
// ============================================
async function fetchUsers() {
  loading.value = true;
  try {
    const params: UserQueryParams = {
      limit: pagination.limit,
      offset: pagination.offset,
    };
    if (searchKeyword.value.trim()) {
      params.keyword = searchKeyword.value.trim();
    }
    if (filterStatus.value) {
      params.status = filterStatus.value;
    }

    const response = await getAdminUsers(params);
    users.value = response.data.data;
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
  fetchUsers();
}

function handleReset() {
  searchKeyword.value = '';
  filterStatus.value = '';
  pagination.offset = 0;
  fetchUsers();
}

function handlePageChange(page: number) {
  currentPage.value = page;
  fetchUsers();
}

function handleSizeChange(size: number) {
  pagination.limit = size;
  pagination.offset = 0;
  fetchUsers();
}

function openCreateDialog() {
  dialogMode.value = 'create';
  userForm.id = undefined;
  userForm.username = '';
  userForm.password = '';
  userForm.email = '';
  userForm.phone = '';
  userForm.nickname = '';
  userForm.status = 'active';
  dialogVisible.value = true;
}

function openEditDialog(user: AdminUserResponse) {
  dialogMode.value = 'edit';
  userForm.id = user.id;
  userForm.username = user.username;
  userForm.password = '';
  userForm.email = user.email || '';
  userForm.phone = user.phone || '';
  userForm.nickname = user.nickname || '';
  userForm.status = user.status;
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!userFormRef.value) return;

  try {
    await userFormRef.value.validate();
  } catch {
    return;
  }

  formLoading.value = true;
  try {
    if (dialogMode.value === 'create') {
      const dto: CreateAdminUserDto = {
        username: userForm.username,
        password: userForm.password,
        email: userForm.email || undefined,
        phone: userForm.phone || undefined,
        nickname: userForm.nickname || undefined,
        status: userForm.status,
      };
      await createAdminUser(dto);
      ElMessage.success('用户创建成功');
    } else if (userForm.id) {
      const dto: UpdateAdminUserDto = {
        email: userForm.email || undefined,
        phone: userForm.phone || undefined,
        nickname: userForm.nickname || undefined,
        status: userForm.status,
      };
      await updateAdminUser(userForm.id, dto);
      ElMessage.success('用户更新成功');
    }
    dialogVisible.value = false;
    fetchUsers();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    formLoading.value = false;
  }
}

async function handleDelete(userId: string) {
  try {
    await deleteAdminUser(userId);
    ElMessage.success('用户删除成功');
    fetchUsers();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

async function handleStatusChange(user: AdminUserResponse, newStatus: UserStatus) {
  try {
    await updateUserStatus(user.id, newStatus);
    ElMessage.success('状态更新成功');
    fetchUsers();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

// ============================================
// Utility Functions
// ============================================
function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
}

function getStatusType(status: UserStatus): '' | 'success' | 'warning' | 'danger' | 'info' {
  const typeMap: Record<UserStatus, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    active: 'success',
    disabled: 'danger',
    pending: 'warning',
  };
  return typeMap[status] || 'info';
}

function getStatusText(status: UserStatus): string {
  const textMap: Record<UserStatus, string> = {
    active: '正常',
    disabled: '禁用',
    pending: '待激活',
  };
  return textMap[status] || status;
}

function formRules() {
  const rules: Record<string, unknown[]> = {
    username: [
      { required: true, message: '请输入用户名', trigger: 'blur' },
      { min: 3, max: 50, message: '用户名长度为 3-50 个字符', trigger: 'blur' },
      { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线', trigger: 'blur' },
    ],
  };

  if (dialogMode.value === 'create') {
    rules.password = [
      { required: true, message: '请输入密码', trigger: 'blur' },
      { min: 6, max: 100, message: '密码长度为 6-100 个字符', trigger: 'blur' },
    ];
  }

  return rules;
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchUsers();
});
</script>

<template>
  <div class="users-page">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <h2>用户管理</h2>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog"> 新增用户 </el-button>
        </div>
      </template>

      <!-- Search and Filter -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索用户名、邮箱、手机号"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select v-model="filterStatus" placeholder="状态筛选" clearable class="status-select">
          <el-option label="正常" value="active" />
          <el-option label="禁用" value="disabled" />
          <el-option label="待激活" value="pending" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">搜索</el-button>
        <el-button :icon="Refresh" @click="handleReset">重置</el-button>
      </div>

      <!-- User Table -->
      <el-table v-if="users.length > 0" :data="users" stripe class="users-table">
        <el-table-column prop="username" label="用户名" min-width="120">
          <template #default="{ row }">
            <div class="user-name">
              <el-icon class="user-icon"><User /></el-icon>
              <span class="name-text">{{ row.username }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="nickname" label="昵称" min-width="100">
          <template #default="{ row }">
            {{ row.nickname || '-' }}
          </template>
        </el-table-column>

        <el-table-column prop="email" label="邮箱" min-width="180">
          <template #default="{ row }">
            <span v-if="row.email">
              {{ row.email }}
              <el-tag v-if="row.emailVerifiedAt" size="small" type="success" class="verify-tag">
                已验证
              </el-tag>
            </span>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="phone" label="手机号" min-width="140">
          <template #default="{ row }">
            <span v-if="row.phone">
              {{ row.phone }}
              <el-tag v-if="row.phoneVerifiedAt" size="small" type="success" class="verify-tag">
                已验证
              </el-tag>
            </span>
            <span v-else class="no-data">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="status" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-dropdown
              trigger="click"
              @command="(cmd: UserStatus) => handleStatusChange(row, cmd)"
            >
              <el-tag :type="getStatusType(row.status)" class="status-tag">
                {{ getStatusText(row.status) }}
              </el-tag>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="active" :disabled="row.status === 'active'">
                    正常
                  </el-dropdown-item>
                  <el-dropdown-item command="disabled" :disabled="row.status === 'disabled'">
                    禁用
                  </el-dropdown-item>
                  <el-dropdown-item command="pending" :disabled="row.status === 'pending'">
                    待激活
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" :icon="Edit" @click="openEditDialog(row)">
                编辑
              </el-button>
              <el-popconfirm
                title="确定要删除该用户吗？"
                confirm-button-text="确定"
                cancel-button-text="取消"
                @confirm="handleDelete(row.id)"
              >
                <template #reference>
                  <el-button type="danger" size="small" :icon="Delete">删除</el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty v-else description="暂无用户数据">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          添加第一个用户
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

    <!-- Create/Edit User Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="userFormRef"
        :model="userForm"
        :rules="formRules()"
        label-width="80px"
        label-position="top"
      >
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="userForm.username"
            placeholder="请输入用户名"
            maxlength="50"
            show-word-limit
            :disabled="dialogMode === 'edit'"
          />
        </el-form-item>

        <el-form-item v-if="dialogMode === 'create'" label="密码" prop="password">
          <el-input
            v-model="userForm.password"
            type="password"
            placeholder="请输入密码"
            maxlength="100"
            show-password
          />
        </el-form-item>

        <el-form-item label="昵称">
          <el-input
            v-model="userForm.nickname"
            placeholder="请输入昵称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="邮箱">
          <el-input v-model="userForm.email" placeholder="请输入邮箱" maxlength="100" />
        </el-form-item>

        <el-form-item label="手机号">
          <el-input v-model="userForm.phone" placeholder="请输入手机号" maxlength="20" />
        </el-form-item>

        <el-form-item label="状态">
          <el-select v-model="userForm.status" placeholder="请选择状态" class="status-form-select">
            <el-option label="正常" value="active" />
            <el-option label="禁用" value="disabled" />
            <el-option label="待激活" value="pending" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formLoading" @click="handleSubmit">
          {{ dialogMode === 'create' ? '创建' : '保存' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.users-page {
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

.status-select {
  width: 140px;
}

.users-table {
  width: 100%;
}

.users-table :deep(.el-table__header th) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #1a1a2e;
}

.users-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.users-table :deep(.el-table__row:hover > td) {
  background-color: #f5f7fa !important;
}

.user-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-icon {
  color: #667eea;
  font-size: 16px;
}

.name-text {
  font-weight: 500;
  color: #1a1a2e;
}

.verify-tag {
  margin-left: 6px;
  font-size: 11px;
}

.no-data {
  color: #c0c4cc;
}

.status-tag {
  cursor: pointer;
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

.status-form-select {
  width: 100%;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
