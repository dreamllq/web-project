<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Search, Refresh, Plus, Edit, Delete } from '@element-plus/icons-vue';
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '@/api/admin-user';
import { extractApiError } from '@/api';
import type {
  AdminUserResponse,
  UserQueryParams,
  CreateAdminUserDto,
  UpdateAdminUserDto,
} from '@/types/user';
import type { UserStatus } from '@/types/auth';

// ============================================
// State
// ============================================
const loading = ref(false);
const users = ref<AdminUserResponse[]>([]);
const total = ref(0);

// Query parameters
const queryParams = reactive<UserQueryParams>({
  keyword: '',
  status: undefined,
  limit: 10,
  offset: 0,
});

// Search debounce timer
let searchTimer: ReturnType<typeof setTimeout> | null = null;

// Status options for filter dropdown
const statusOptions: { value: UserStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'pending', label: 'Pending' },
];

// Dialog state
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const formRef = ref();
const formLoading = ref(false);

// Form data
const formData = reactive<{
  id: string;
  username: string;
  password: string;
  email: string;
  phone: string;
  nickname: string;
  status: UserStatus;
}>({
  id: '',
  username: '',
  password: '',
  email: '',
  phone: '',
  nickname: '',
  status: 'active',
});

// ============================================
// Computed
// ============================================
const currentPage = {
  get: () => Math.floor((queryParams.offset ?? 0) / (queryParams.limit || 10)) + 1,
  set: (page: number) => {
    queryParams.offset = (page - 1) * (queryParams.limit || 10);
  },
};

const pageSize = {
  get: () => queryParams.limit || 10,
  set: (size: number) => {
    queryParams.limit = size;
    queryParams.offset = 0;
  },
};

const dialogTitle = computed(() => (dialogMode.value === 'create' ? 'Create User' : 'Edit User'));

// ============================================
// Functions
// ============================================
async function fetchUsers() {
  loading.value = true;
  try {
    const response = await getAdminUsers(queryParams);
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
  // Debounce search
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => {
    queryParams.offset = 0;
    fetchUsers();
  }, 300);
}

function handleStatusChange() {
  queryParams.offset = 0;
  fetchUsers();
}

function handleReset() {
  queryParams.keyword = '';
  queryParams.status = undefined;
  queryParams.offset = 0;
  fetchUsers();
}

function handlePageChange(page: number) {
  currentPage.set(page);
  fetchUsers();
}

function handleSizeChange(size: number) {
  pageSize.set(size);
  fetchUsers();
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
}

function getStatusType(status: UserStatus): '' | 'success' | 'warning' | 'danger' | 'info' {
  const statusMap: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    active: 'success',
    disabled: 'danger',
    pending: 'warning',
    banned: 'info',
  };
  return statusMap[status] || 'info';
}

function getStatusLabel(status: UserStatus): string {
  const statusMap: Record<string, string> = {
    active: 'Active',
    disabled: 'Disabled',
    pending: 'Pending',
    banned: 'Banned',
  };
  return statusMap[status] || status;
}

// ============================================
// Form Validation Rules
// ============================================
function formRules() {
  const baseRules: Record<string, unknown[]> = {
    status: [{ required: true, message: 'Please select status', trigger: 'change' }],
  };

  if (dialogMode.value === 'create') {
    baseRules.username = [
      { required: true, message: 'Please enter username', trigger: 'blur' },
      { min: 2, max: 50, message: 'Username must be 2-50 characters', trigger: 'blur' },
      {
        pattern: /^[a-zA-Z0-9_]+$/,
        message: 'Username can only contain letters, numbers, and underscores',
        trigger: 'blur',
      },
    ];
    baseRules.password = [
      { required: true, message: 'Please enter password', trigger: 'blur' },
      { min: 8, message: 'Password must be at least 8 characters', trigger: 'blur' },
      {
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
        message: 'Password must contain uppercase, lowercase, and a digit',
        trigger: 'blur',
      },
    ];
  }

  baseRules.email = [
    {
      type: 'email',
      message: 'Please enter a valid email address',
      trigger: 'blur',
    },
  ];

  return baseRules;
}

// ============================================
// Dialog Functions
// ============================================
function resetForm() {
  formData.id = '';
  formData.username = '';
  formData.password = '';
  formData.email = '';
  formData.phone = '';
  formData.nickname = '';
  formData.status = 'active';
}

function openCreateDialog() {
  dialogMode.value = 'create';
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(user: AdminUserResponse) {
  dialogMode.value = 'edit';
  formData.id = user.id;
  formData.username = user.username;
  formData.password = '';
  formData.email = user.email || '';
  formData.phone = user.phone || '';
  formData.nickname = user.nickname || '';
  formData.status = user.status;
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  formLoading.value = true;
  try {
    if (dialogMode.value === 'create') {
      const createDto: CreateAdminUserDto = {
        username: formData.username,
        password: formData.password,
      };
      if (formData.email) createDto.email = formData.email;
      if (formData.phone) createDto.phone = formData.phone;
      if (formData.nickname) createDto.nickname = formData.nickname;
      if (formData.status) createDto.status = formData.status;

      await createAdminUser(createDto);
      ElMessage.success('User created successfully');
    } else {
      const updateDto: UpdateAdminUserDto = {};
      if (formData.email) updateDto.email = formData.email;
      if (formData.phone) updateDto.phone = formData.phone;
      if (formData.nickname) updateDto.nickname = formData.nickname;
      if (formData.status) updateDto.status = formData.status;

      await updateAdminUser(formData.id, updateDto);
      ElMessage.success('User updated successfully');
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
    ElMessage.success('User deleted successfully');
    fetchUsers();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchUsers();
});

// Watch for keyword changes with debounce
watch(
  () => queryParams.keyword,
  () => {
    handleSearch();
  }
);
</script>

<template>
  <div class="users-page">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <h2>User Management</h2>
          <div class="header-actions">
            <el-button type="primary" :icon="Plus" @click="openCreateDialog">
              <el-icon><Plus /></el-icon>
              Create User
            </el-button>
          </div>
        </div>
      </template>

      <!-- Search and Filter Bar -->
      <div class="search-bar">
        <div class="search-inputs">
          <el-input
            v-model="queryParams.keyword"
            placeholder="Search by username, email, or phone..."
            :prefix-icon="Search"
            clearable
            class="keyword-input"
            @clear="handleSearch"
          />
          <el-select
            v-model="queryParams.status"
            placeholder="All Status"
            clearable
            class="status-select"
            @change="handleStatusChange"
          >
            <el-option
              v-for="option in statusOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>
        <el-button :icon="Refresh" @click="handleReset">Reset</el-button>
      </div>

      <!-- User Table -->
      <el-table v-if="users.length > 0" :data="users" stripe class="users-table">
        <el-table-column prop="username" label="Username" min-width="140">
          <template #default="{ row }">
            <div class="user-info">
              <div class="user-avatar">
                {{ row.username.charAt(0).toUpperCase() }}
              </div>
              <span class="username">{{ row.username }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="email" label="Email" min-width="200">
          <template #default="{ row }">
            <span class="email-text">{{ row.email || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="phone" label="Phone" min-width="140">
          <template #default="{ row }">
            {{ row.phone || '-' }}
          </template>
        </el-table-column>

        <el-table-column prop="nickname" label="Nickname" min-width="120">
          <template #default="{ row }">
            {{ row.nickname || '-' }}
          </template>
        </el-table-column>

        <el-table-column prop="status" label="Status" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" class="status-tag">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="Created At" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column label="Actions" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" :icon="Edit" @click="openEditDialog(row)">
                Edit
              </el-button>
              <el-popconfirm
                title="Are you sure you want to delete this user?"
                confirm-button-text="Confirm"
                cancel-button-text="Cancel"
                @confirm="handleDelete(row.id)"
              >
                <template #reference>
                  <el-button type="danger" size="small" :icon="Delete"> Delete </el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty v-else description="No users found">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          Create First User
        </el-button>
      </el-empty>

      <!-- Pagination -->
      <div v-if="users.length > 0" class="pagination-container">
        <el-pagination
          :current-page="currentPage.get()"
          :page-size="pageSize.get()"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handlePageChange"
          @size-change="handleSizeChange"
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
        ref="formRef"
        :model="formData"
        :rules="formRules()"
        label-width="120px"
        label-position="top"
      >
        <el-form-item v-if="dialogMode === 'create'" label="Username" prop="username">
          <el-input
            v-model="formData.username"
            placeholder="Enter username (letters, numbers, underscores)"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item v-if="dialogMode === 'create'" label="Password" prop="password">
          <el-input
            v-model="formData.password"
            type="password"
            placeholder="Enter password (min 8 chars, with upper/lower/digit)"
            show-password
          />
        </el-form-item>

        <el-form-item label="Email" prop="email">
          <el-input v-model="formData.email" placeholder="Enter email address" clearable />
        </el-form-item>

        <el-form-item label="Phone" prop="phone">
          <el-input v-model="formData.phone" placeholder="Enter phone number" clearable />
        </el-form-item>

        <el-form-item label="Nickname" prop="nickname">
          <el-input
            v-model="formData.nickname"
            placeholder="Enter display name"
            maxlength="50"
            show-word-limit
            clearable
          />
        </el-form-item>

        <el-form-item label="Status" prop="status">
          <el-select v-model="formData.status" placeholder="Select status" class="status-full">
            <el-option label="Active" value="active" />
            <el-option label="Pending" value="pending" />
            <el-option label="Disabled" value="disabled" />
          </el-select>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="formLoading" @click="handleSubmit">
          {{ dialogMode === 'create' ? 'Create' : 'Save' }}
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

.header-actions {
  display: flex;
  gap: 12px;
}

/* Search Bar */
.search-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
}

.search-inputs {
  display: flex;
  gap: 12px;
  flex: 1;
}

.keyword-input {
  max-width: 320px;
}

.status-select {
  width: 140px;
}

/* Table Styles */
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

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
}

.username {
  font-weight: 500;
  color: #1a1a2e;
}

.email-text {
  color: #606266;
}

.status-tag {
  font-weight: 500;
  min-width: 70px;
  justify-content: center;
}

.status-tag:deep(.el-tag--success) {
  background-color: #e8f5e9;
  border-color: #c8e6c9;
  color: #2e7d32;
}

.status-tag:deep(.el-tag--danger) {
  background-color: #ffebee;
  border-color: #ffcdd2;
  color: #c62828;
}

.status-tag:deep(.el-tag--warning) {
  background-color: #fff8e1;
  border-color: #ffecb3;
  color: #f57c00;
}

.status-tag:deep(.el-tag--info) {
  background-color: #f5f5f5;
  border-color: #e0e0e0;
  color: #616161;
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

/* Pagination */
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 16px;
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

.status-full {
  width: 100%;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
