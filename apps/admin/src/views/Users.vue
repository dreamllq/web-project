<script setup lang="ts">
import { ref, reactive, watch, onMounted, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Search, Refresh, Plus, Edit, Delete, Key } from '@element-plus/icons-vue';
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  batchAssignRoles,
} from '@/api/admin-user';
import { getRoles, getUserRoles, assignUserRoles } from '@/api/rbac';
import { getAuditLogsByUser } from '@/api/audit-log';
import { extractApiError } from '@/api';
import type {
  AdminUserResponse,
  UserQueryParams,
  CreateAdminUserDto,
  UpdateAdminUserDto,
} from '@/types/user';
import type { UserStatus } from '@/types/auth';
import type { Role } from '@/types/rbac';
import type { AuditLog, AuditLogListResponse } from '@/types/audit-log';
import type { ElTable } from 'element-plus';

// i18n
const { t } = useI18n();

// State
const loading = ref(false);
const users = ref<AdminUserResponse[]>([]);
const total = ref(0);
const queryParams = reactive<UserQueryParams>({
  keyword: '',
  status: undefined,
  limit: 10,
  offset: 0,
});
let searchTimer: ReturnType<typeof setTimeout> | null = null;
const statusOptions: { value: UserStatus; label: string }[] = [
  { value: 'active', label: t('users.active', 'Active') },
  { value: 'disabled', label: t('users.disabled', 'Disabled') },
  { value: 'pending', label: t('users.pending', 'Pending') },
];
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const formRef = ref();
const formLoading = ref(false);
const tableRef = ref<InstanceType<typeof ElTable>>();
const selectedUsers = ref<AdminUserResponse[]>([]);
const roleDialogVisible = ref(false);
const roleLoading = ref(false);
const roles = ref<Role[]>([]);
const selectedRoleIds = ref<string[]>([]);
const currentUserForRole = ref<AdminUserResponse | null>(null);
const isBatchRoleAssign = ref(false);
// Audit log state
const auditLogs = ref<AuditLog[]>([]);
const auditLogLoading = ref(false);
const auditLogTotal = ref(0);
const auditLogPage = ref(1);
const auditLogPageSize = ref(10);
const activeDialogTab = ref('details');
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

// Computed
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
const canBatchAssign = computed(() => selectedUsers.value.length > 0);

// Functions
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

async function fetchRoles() {
  try {
    const response = await getRoles();
    roles.value = response.data.data;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

function handleSearch() {
  if (searchTimer) clearTimeout(searchTimer);
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
  return new Date(dateString).toLocaleString();
}

function getStatusType(status: UserStatus): '' | 'success' | 'warning' | 'danger' | 'info' {
  const statusMap: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    active: 'success',
    disabled: 'danger',
    pending: 'warning',
  };
  return statusMap[status] || 'info';
}

function getStatusLabel(status: UserStatus): string {
  const statusMap: Record<string, string> = {
    active: t('users.active', 'Active'),
    disabled: t('users.disabled', 'Disabled'),
    pending: t('users.pending', 'Pending'),
  };
  return statusMap[status] || status;
}

// Audit log helper functions
function _formatAuditAction(action: string): string {
  const actionMap: Record<string, string> = {
    'user.create': t('auditLog.userCreate', 'Create User'),
    'user.update': t('auditLog.userUpdate', 'Update User'),
    'user.delete': t('auditLog.userDelete', 'Delete User'),
    'user.login': t('auditLog.userLogin', 'Login'),
    'user.logout': t('auditLog.userLogout', 'Logout'),
    'policy.create': t('auditLog.policyCreate', 'Create Policy'),
    'policy.update': t('auditLog.policyUpdate', 'Update Policy'),
    'policy.delete': t('auditLog.policyDelete', 'Delete Policy'),
  };
  return actionMap[action] || action;
}

function _getAuditActionType(action: string): 'success' | 'warning' | 'danger' | 'info' {
  if (action.includes('.create')) return 'success';
  if (action.includes('.update')) return 'warning';
  if (action.includes('.delete')) return 'danger';
  return 'info';
}

function _truncateDetails(data: Record<string, unknown> | null): string {
  if (!data) return '-';
  const str = JSON.stringify(data);
  return str.length > 50 ? str.substring(0, 50) + '...' : str;
}

function formRules() {
  const baseRules: Record<string, unknown[]> = {
    status: [
      {
        required: true,
        message: t('common.selectStatus', 'Please select status'),
        trigger: 'change',
      },
    ],
  };
  if (dialogMode.value === 'create') {
    baseRules.username = [
      {
        required: true,
        message: t('users.usernameRequired', 'Please enter username'),
        trigger: 'blur',
      },
      {
        min: 2,
        max: 50,
        message: t('users.usernameLength', 'Username must be 2-50 characters'),
        trigger: 'blur',
      },
      {
        pattern: /^[a-zA-Z0-9_]+$/,
        message: t(
          'users.usernamePattern',
          'Username can only contain letters, numbers, and underscores'
        ),
        trigger: 'blur',
      },
    ];
    baseRules.password = [
      {
        required: true,
        message: t('users.passwordRequired', 'Please enter password'),
        trigger: 'blur',
      },
      {
        min: 8,
        message: t('users.passwordMinLength', 'Password must be at least 8 characters'),
        trigger: 'blur',
      },
      {
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
        message: t(
          'users.passwordPattern',
          'Password must contain uppercase, lowercase, and a digit'
        ),
        trigger: 'blur',
      },
    ];
  }
  baseRules.email = [
    {
      type: 'email',
      message: t('users.emailInvalid', 'Please enter a valid email address'),
      trigger: 'blur',
    },
  ];
  return baseRules;
}

function resetForm() {
  formData.id = '';
  formData.username = '';
  formData.password = '';
  formData.email = '';
  formData.phone = '';
  formData.nickname = '';
  formData.status = 'active';
  // Reset audit log state
  auditLogs.value = [];
  auditLogTotal.value = 0;
  auditLogPage.value = 1;
  activeDialogTab.value = 'details';
}

// Fetch audit logs for the current user
async function fetchUserAuditLogs(userId: string) {
  auditLogLoading.value = true;
  try {
    const response: AuditLogListResponse = await getAuditLogsByUser(
      userId,
      auditLogPageSize.value,
      auditLogPage.value
    );
    auditLogs.value = response.data;
    auditLogTotal.value = response.total;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    auditLogLoading.value = false;
  }
}

function _handleAuditLogPageChange(page: number) {
  auditLogPage.value = page;
  if (formData.id) {
    fetchUserAuditLogs(formData.id);
  }
}

function _handleAuditLogSizeChange(size: number) {
  auditLogPageSize.value = size;
  auditLogPage.value = 1;
  if (formData.id) {
    fetchUserAuditLogs(formData.id);
  }
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
  activeDialogTab.value = 'details';
  dialogVisible.value = true;
  // Fetch audit logs for this user
  fetchUserAuditLogs(user.id);
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
      ElMessage.success(t('users.createSuccess', 'User created successfully'));
    } else {
      const updateDto: UpdateAdminUserDto = {};
      if (formData.email) updateDto.email = formData.email;
      if (formData.phone) updateDto.phone = formData.phone;
      if (formData.nickname) updateDto.nickname = formData.nickname;
      if (formData.status) updateDto.status = formData.status;
      await updateAdminUser(formData.id, updateDto);
      ElMessage.success(t('users.updateSuccess', 'User updated successfully'));
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
    ElMessage.success(t('users.deleteSuccess', 'User deleted successfully'));
    fetchUsers();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

async function openRoleDialog(user: AdminUserResponse) {
  currentUserForRole.value = user;
  isBatchRoleAssign.value = false;
  selectedRoleIds.value = [];
  roleDialogVisible.value = true;
  roleLoading.value = true;
  try {
    const response = await getUserRoles(user.id);
    selectedRoleIds.value = response.data.roles.map((r) => r.id);
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    roleLoading.value = false;
  }
}

function openBatchRoleDialog() {
  isBatchRoleAssign.value = true;
  currentUserForRole.value = null;
  selectedRoleIds.value = [];
  roleDialogVisible.value = true;
}

async function handleRoleSubmit() {
  roleLoading.value = true;
  try {
    if (isBatchRoleAssign.value) {
      await batchAssignRoles({
        userIds: selectedUsers.value.map((u) => u.id),
        roleIds: selectedRoleIds.value,
      });
      ElMessage.success('Roles assigned to ' + selectedUsers.value.length + ' users');
      tableRef.value?.clearSelection();
      selectedUsers.value = [];
    } else if (currentUserForRole.value) {
      await assignUserRoles(currentUserForRole.value.id, { roleIds: selectedRoleIds.value });
      ElMessage.success('Roles assigned successfully');
    }
    roleDialogVisible.value = false;
    fetchUsers();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    roleLoading.value = false;
  }
}

function handleSelectionChange(selection: AdminUserResponse[]) {
  selectedUsers.value = selection;
}

onMounted(() => {
  fetchUsers();
  fetchRoles();
});
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
            <el-button
              type="info"
              :icon="Key"
              :disabled="!canBatchAssign"
              @click="openBatchRoleDialog"
              >Batch Assign Roles<span v-if="selectedUsers.length > 0"
                >({{ selectedUsers.length }})</span
              ></el-button
            >
            <el-button type="primary" :icon="Plus" @click="openCreateDialog"
              ><el-icon><Plus /></el-icon>Create User</el-button
            >
          </div>
        </div>
      </template>
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
            ><el-option
              v-for="option in statusOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
          /></el-select>
        </div>
        <el-button :icon="Refresh" @click="handleReset">Reset</el-button>
      </div>
      <el-table
        v-if="users.length > 0"
        ref="tableRef"
        :data="users"
        stripe
        class="users-table"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" />
        <el-table-column prop="username" label="Username" min-width="140"
          ><template #default="{ row }"
            ><div class="user-info">
              <div class="user-avatar">{{ row.username.charAt(0).toUpperCase() }}</div>
              <span class="username">{{ row.username }}</span>
            </div></template
          ></el-table-column
        >
        <el-table-column prop="email" label="Email" min-width="180"
          ><template #default="{ row }"
            ><span class="email-text">{{ row.email || '-' }}</span></template
          ></el-table-column
        >
        <el-table-column prop="phone" label="Phone" min-width="120"
          ><template #default="{ row }">{{ row.phone || '-' }}</template></el-table-column
        >
        <el-table-column prop="status" label="Status" width="100" align="center"
          ><template #default="{ row }"
            ><el-tag :type="getStatusType(row.status)" size="small" class="status-tag">{{
              getStatusLabel(row.status)
            }}</el-tag></template
          ></el-table-column
        >
        <el-table-column label="Roles" min-width="180"
          ><template #default="{ row }"
            ><div class="role-tags">
              <el-tag
                v-for="role in (row.roles || []).slice(0, 2)"
                :key="role.id"
                size="small"
                class="role-tag"
                >{{ role.name }}</el-tag
              ><el-tag v-if="(row.roles || []).length > 2" size="small" type="info" class="more-tag"
                >+{{ row.roles.length - 2 }}</el-tag
              ><span v-if="!row.roles || row.roles.length === 0" class="no-roles">No roles</span>
            </div></template
          ></el-table-column
        >
        <el-table-column label="Created At" min-width="160"
          ><template #default="{ row }">{{ formatDate(row.createdAt) }}</template></el-table-column
        >
        <el-table-column label="Actions" width="240" fixed="right" align="center"
          ><template #default="{ row }"
            ><div class="action-buttons">
              <el-button type="warning" size="small" :icon="Key" @click="openRoleDialog(row)"
                >Roles</el-button
              ><el-button type="primary" size="small" :icon="Edit" @click="openEditDialog(row)"
                >Edit</el-button
              ><el-popconfirm
                title="Are you sure you want to delete this user?"
                confirm-button-text="Confirm"
                cancel-button-text="Cancel"
                @confirm="handleDelete(row.id)"
                ><template #reference
                  ><el-button type="danger" size="small" :icon="Delete">Delete</el-button></template
                ></el-popconfirm
              >
            </div></template
          ></el-table-column
        >
      </el-table>
      <el-empty v-else description="No users found"
        ><el-button type="primary" :icon="Plus" @click="openCreateDialog"
          >Create First User</el-button
        ></el-empty
      >
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
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? 'Create User' : 'Edit User'"
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
        <el-form-item v-if="dialogMode === 'create'" label="Username" prop="username"
          ><el-input
            v-model="formData.username"
            placeholder="Enter username (letters, numbers, underscores)"
            maxlength="50"
            show-word-limit
        /></el-form-item>
        <el-form-item v-if="dialogMode === 'create'" label="Password" prop="password"
          ><el-input
            v-model="formData.password"
            type="password"
            placeholder="Enter password (min 8 chars, with upper/lower/digit)"
            show-password
        /></el-form-item>
        <el-form-item label="Email" prop="email"
          ><el-input v-model="formData.email" placeholder="Enter email address" clearable
        /></el-form-item>
        <el-form-item label="Phone" prop="phone"
          ><el-input v-model="formData.phone" placeholder="Enter phone number" clearable
        /></el-form-item>
        <el-form-item label="Nickname" prop="nickname"
          ><el-input
            v-model="formData.nickname"
            placeholder="Enter display name"
            maxlength="50"
            show-word-limit
            clearable
        /></el-form-item>
        <el-form-item label="Status" prop="status"
          ><el-select v-model="formData.status" placeholder="Select status" class="status-full"
            ><el-option label="Active" value="active" /><el-option
              label="Disabled"
              value="disabled" /><el-option label="Pending" value="pending" /></el-select
        ></el-form-item>
      </el-form>
      <template #footer
        ><el-button @click="dialogVisible = false">Cancel</el-button
        ><el-button type="primary" :loading="formLoading" @click="handleSubmit">{{
          dialogMode === 'create' ? 'Create' : 'Save'
        }}</el-button></template
      >
    </el-dialog>
    <el-dialog
      v-model="roleDialogVisible"
      :title="isBatchRoleAssign ? 'Batch Assign Roles' : 'Assign Roles'"
      width="550px"
      :close-on-click-modal="false"
    >
      <div v-if="isBatchRoleAssign" class="batch-info">
        <el-alert type="info" :closable="false" show-icon
          ><template #title
            >Assigning roles to {{ selectedUsers.length }} selected users</template
          ></el-alert
        >
        <div class="selected-users">
          <el-tag
            v-for="user in selectedUsers.slice(0, 5)"
            :key="user.id"
            size="small"
            class="user-tag"
            >{{ user.username }}</el-tag
          ><el-tag v-if="selectedUsers.length > 5" size="small" type="info"
            >+{{ selectedUsers.length - 5 }} more</el-tag
          >
        </div>
      </div>
      <div v-else-if="currentUserForRole" class="single-user-info">
        <el-descriptions :column="1" border size="small"
          ><el-descriptions-item label="User">{{
            currentUserForRole.username
          }}</el-descriptions-item
          ><el-descriptions-item label="Email">{{
            currentUserForRole.email || '-'
          }}</el-descriptions-item></el-descriptions
        >
      </div>
      <div class="role-selection">
        <h4>Select Roles</h4>
        <el-checkbox-group v-model="selectedRoleIds" v-loading="roleLoading"
          ><div class="role-list">
            <div
              v-for="role in roles"
              :key="role.id"
              class="role-item"
              :class="{ selected: selectedRoleIds.includes(role.id) }"
            >
              <el-checkbox :value="role.id"
                ><div class="role-info">
                  <span class="role-name">{{ role.name }}</span
                  ><span class="role-desc">{{ role.description || 'No description' }}</span>
                </div></el-checkbox
              >
            </div>
          </div></el-checkbox-group
        >
      </div>
      <template #footer
        ><el-button @click="roleDialogVisible = false">Cancel</el-button
        ><el-button
          type="primary"
          :loading="roleLoading"
          :disabled="selectedRoleIds.length === 0 && !isBatchRoleAssign"
          @click="handleRoleSubmit"
          >{{ isBatchRoleAssign ? 'Assign to All' : 'Save Assignment' }}</el-button
        ></template
      >
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
.role-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.role-tag {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #fff;
}
.more-tag {
  background: #f0f0f0;
  border: none;
}
.no-roles {
  color: #909399;
  font-size: 13px;
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
.pagination-container {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
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
.status-full {
  width: 100%;
}
.batch-info {
  margin-bottom: 20px;
}
.selected-users {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.user-tag {
  background: #f0f9ff;
  border-color: #67c23a;
}
.single-user-info {
  margin-bottom: 20px;
}
.role-selection h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}
.role-list {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}
.role-item {
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  transition: background-color 0.2s;
}
.role-item:last-child {
  border-bottom: none;
}
.role-item:hover {
  background-color: #f5f7fa;
}
.role-item.selected {
  background-color: #f0f9ff;
}
.role-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.role-name {
  font-weight: 500;
  color: #1a1a2e;
}
.role-desc {
  font-size: 12px;
  color: #909399;
}
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
