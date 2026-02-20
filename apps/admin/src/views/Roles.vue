<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Edit, Delete, User, Key } from '@element-plus/icons-vue';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getPermissions,
  getUserRoles,
  assignUserRoles,
} from '@/api/rbac';
import { extractApiError } from '@/api';
import type { Role, Permission, CreateRoleDto } from '@/types/rbac';

// ============================================
// State
// ============================================
const loading = ref(false);
const roles = ref<Role[]>([]);
const permissions = ref<Permission[]>([]);

// Role form dialog
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const roleFormRef = ref();
const roleForm = reactive<CreateRoleDto & { id?: string }>({
  name: '',
  description: '',
  permissionIds: [],
});
const formLoading = ref(false);

// User role assignment dialog
const assignDialogVisible = ref(false);
const assignLoading = ref(false);
const userIdInput = ref('');
const userCurrentRoles = ref<Role[]>([]);

// ============================================
// Computed
// ============================================
const dialogTitle = computed(() => (dialogMode.value === 'create' ? 'Create Role' : 'Edit Role'));

const permissionOptions = computed(() =>
  permissions.value.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.resource}:${p.action})`,
  }))
);

// ============================================
// Role CRUD Functions
// ============================================
async function fetchRoles() {
  loading.value = true;
  try {
    const response = await getRoles();
    roles.value = response.data;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

async function fetchPermissions() {
  try {
    const response = await getPermissions();
    permissions.value = response.data;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

function openCreateDialog() {
  dialogMode.value = 'create';
  roleForm.id = undefined;
  roleForm.name = '';
  roleForm.description = '';
  roleForm.permissionIds = [];
  dialogVisible.value = true;
}

async function openEditDialog(role: Role) {
  dialogMode.value = 'edit';
  roleForm.id = role.id;
  roleForm.name = role.name;
  roleForm.description = role.description || '';
  roleForm.permissionIds = role.permissions.map((p) => p.id);
  dialogVisible.value = true;
}

async function handleSubmit() {
  if (!roleFormRef.value) return;

  try {
    await roleFormRef.value.validate();
  } catch {
    return;
  }

  formLoading.value = true;
  try {
    if (dialogMode.value === 'create') {
      await createRole({
        name: roleForm.name,
        description: roleForm.description,
        permissionIds: roleForm.permissionIds,
      });
      ElMessage.success('Role created successfully');
    } else if (roleForm.id) {
      await updateRole(roleForm.id, {
        name: roleForm.name,
        description: roleForm.description,
        permissionIds: roleForm.permissionIds,
      });
      ElMessage.success('Role updated successfully');
    }
    dialogVisible.value = false;
    fetchRoles();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    formLoading.value = false;
  }
}

async function handleDelete(roleId: string) {
  try {
    await deleteRole(roleId);
    ElMessage.success('Role deleted successfully');
    fetchRoles();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

// ============================================
// User Role Assignment Functions
// ============================================
async function openAssignDialog() {
  userIdInput.value = '';
  userCurrentRoles.value = [];
  assignDialogVisible.value = true;
}

async function fetchUserRoles() {
  if (!userIdInput.value.trim()) {
    ElMessage.warning('Please enter a user ID');
    return;
  }

  assignLoading.value = true;
  try {
    const response = await getUserRoles(userIdInput.value.trim());
    userCurrentRoles.value = response.data.roles;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
    userCurrentRoles.value = [];
  } finally {
    assignLoading.value = false;
  }
}

async function handleAssignRoles() {
  if (!userIdInput.value.trim()) {
    ElMessage.warning('Please enter a user ID');
    return;
  }

  assignLoading.value = true;
  try {
    const roleIds = userCurrentRoles.value.map((r) => r.id);
    await assignUserRoles(userIdInput.value.trim(), { roleIds });
    ElMessage.success('Roles assigned successfully');
    assignDialogVisible.value = false;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    assignLoading.value = false;
  }
}

function handleRoleToggle(roleId: string) {
  const index = userCurrentRoles.value.findIndex((r) => r.id === roleId);
  if (index > -1) {
    userCurrentRoles.value.splice(index, 1);
  } else {
    const role = roles.value.find((r) => r.id === roleId);
    if (role) {
      userCurrentRoles.value.push(role);
    }
  }
}

function isRoleAssigned(roleId: string): boolean {
  return userCurrentRoles.value.some((r) => r.id === roleId);
}

// ============================================
// Utility Functions
// ============================================
function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
}

function formRules() {
  return {
    name: [
      { required: true, message: 'Please enter role name', trigger: 'blur' },
      { min: 2, max: 50, message: 'Name must be 2-50 characters', trigger: 'blur' },
    ],
  };
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchRoles();
  fetchPermissions();
});
</script>

<template>
  <div class="roles-page">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <h2>Role Management</h2>
          <div class="header-actions">
            <el-button type="info" :icon="User" @click="openAssignDialog">
              Assign Roles to User
            </el-button>
            <el-button type="primary" :icon="Plus" @click="openCreateDialog">
              Create Role
            </el-button>
          </div>
        </div>
      </template>

      <!-- Role Table -->
      <el-table v-if="roles.length > 0" :data="roles" stripe class="roles-table">
        <el-table-column prop="name" label="Role Name" min-width="150">
          <template #default="{ row }">
            <div class="role-name">
              <el-icon class="role-icon"><Key /></el-icon>
              <span class="name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="description" label="Description" min-width="200">
          <template #default="{ row }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>

        <el-table-column label="Permissions" min-width="280">
          <template #default="{ row }">
            <div class="permission-tags">
              <el-tag
                v-for="permission in row.permissions.slice(0, 3)"
                :key="permission.id"
                size="small"
                class="permission-tag"
              >
                {{ permission.name }}
              </el-tag>
              <el-tag v-if="row.permissions.length > 3" size="small" type="info" class="more-tag">
                +{{ row.permissions.length - 3 }} more
              </el-tag>
              <span v-if="row.permissions.length === 0" class="no-permissions">
                No permissions
              </span>
            </div>
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
                title="Are you sure you want to delete this role?"
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
      <el-empty v-else description="No roles found">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          Create First Role
        </el-button>
      </el-empty>
    </el-card>

    <!-- Create/Edit Role Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="560px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="roleFormRef"
        :model="roleForm"
        :rules="formRules()"
        label-width="120px"
        label-position="top"
      >
        <el-form-item label="Role Name" prop="name">
          <el-input
            v-model="roleForm.name"
            placeholder="Enter role name"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="Description">
          <el-input
            v-model="roleForm.description"
            type="textarea"
            :rows="3"
            placeholder="Enter role description"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="Permissions">
          <el-select
            v-model="roleForm.permissionIds"
            multiple
            filterable
            placeholder="Select permissions"
            class="permission-select"
          >
            <el-option
              v-for="option in permissionOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
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

    <!-- User Role Assignment Dialog -->
    <el-dialog
      v-model="assignDialogVisible"
      title="Assign Roles to User"
      width="600px"
      :close-on-click-modal="false"
    >
      <div class="assign-form">
        <div class="user-search">
          <el-input
            v-model="userIdInput"
            placeholder="Enter user ID"
            clearable
            class="user-id-input"
          >
            <template #prepend>User ID</template>
          </el-input>
          <el-button type="primary" :loading="assignLoading" @click="fetchUserRoles">
            Search
          </el-button>
        </div>

        <div v-if="userCurrentRoles.length > 0" class="current-roles">
          <h4>Current Roles</h4>
          <el-tag
            v-for="role in userCurrentRoles"
            :key="role.id"
            closable
            type="success"
            class="assigned-role-tag"
            @close="handleRoleToggle(role.id)"
          >
            {{ role.name }}
          </el-tag>
        </div>

        <div class="available-roles">
          <h4>Available Roles</h4>
          <div class="role-list">
            <div
              v-for="role in roles"
              :key="role.id"
              class="role-item"
              :class="{ assigned: isRoleAssigned(role.id) }"
              @click="handleRoleToggle(role.id)"
            >
              <div class="role-info">
                <span class="role-name-text">{{ role.name }}</span>
                <span class="role-desc">{{ role.description || 'No description' }}</span>
              </div>
              <el-checkbox :model-value="isRoleAssigned(role.id)" />
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="assignDialogVisible = false">Cancel</el-button>
        <el-button type="primary" :loading="assignLoading" @click="handleAssignRoles">
          Save Assignment
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.roles-page {
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

.roles-table {
  width: 100%;
}

.roles-table :deep(.el-table__header th) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #1a1a2e;
}

.roles-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.roles-table :deep(.el-table__row:hover > td) {
  background-color: #f5f7fa !important;
}

.role-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-icon {
  color: #667eea;
  font-size: 16px;
}

.name-text {
  font-weight: 500;
  color: #1a1a2e;
}

.permission-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.permission-tag {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #fff;
}

.more-tag {
  background: #f0f0f0;
  border: none;
}

.no-permissions {
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

.permission-select {
  width: 100%;
}

/* User Assignment Dialog */
.assign-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.user-search {
  display: flex;
  gap: 12px;
}

.user-id-input {
  flex: 1;
}

.current-roles {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.current-roles h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a2e;
}

.assigned-role-tag {
  margin-right: 8px;
  margin-bottom: 8px;
}

.available-roles h4 {
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #ebeef5;
  cursor: pointer;
  transition: background-color 0.2s;
}

.role-item:last-child {
  border-bottom: none;
}

.role-item:hover {
  background-color: #f5f7fa;
}

.role-item.assigned {
  background-color: #f0f9ff;
}

.role-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.role-name-text {
  font-weight: 500;
  color: #1a1a2e;
}

.role-desc {
  font-size: 12px;
  color: #909399;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
