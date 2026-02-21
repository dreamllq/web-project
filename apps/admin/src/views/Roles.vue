<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Edit, Delete, Key, Refresh } from '@element-plus/icons-vue';
import { getRoles, createRole, updateRole, deleteRole } from '@/api/role';
import { getPermissions } from '@/api/permission';
import { extractApiError } from '@/api';
import type { Role, Permission, CreateRoleDto, UpdateRoleDto } from '@/types/permission';

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
const roleForm = reactive<{
  id?: string;
  name: string;
  description: string;
  permissionIds: string[];
}>({
  name: '',
  description: '',
  permissionIds: [],
});
const formLoading = ref(false);

// Permission collapse expanded groups
const expandedGroups = ref<string[]>([]);

// ============================================
// Computed
// ============================================
const dialogTitle = computed(() => (dialogMode.value === 'create' ? '新增角色' : '编辑角色'));

// Group permissions by resource
const groupedPermissions = computed(() => {
  const groups: Record<string, Permission[]> = {};
  for (const perm of permissions.value) {
    if (!groups[perm.resource]) {
      groups[perm.resource] = [];
    }
    groups[perm.resource].push(perm);
  }
  return groups;
});

// ============================================
// CRUD Functions
// ============================================
async function fetchRoles() {
  loading.value = true;
  try {
    const response = await getRoles();
    roles.value = response.data.data;
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
    permissions.value = response.data.data;
    // Expand all groups by default
    expandedGroups.value = Object.keys(groupedPermissions.value);
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

function openEditDialog(role: Role) {
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
      const dto: CreateRoleDto = {
        name: roleForm.name,
        description: roleForm.description || undefined,
        permissionIds: roleForm.permissionIds.length > 0 ? roleForm.permissionIds : undefined,
      };
      await createRole(dto);
      ElMessage.success('角色创建成功');
    } else if (roleForm.id) {
      const dto: UpdateRoleDto = {
        name: roleForm.name,
        description: roleForm.description || null,
        permissionIds: roleForm.permissionIds,
      };
      await updateRole(roleForm.id, dto);
      ElMessage.success('角色更新成功');
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
    ElMessage.success('角色删除成功');
    fetchRoles();
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

function formRules() {
  return {
    name: [
      { required: true, message: '请输入角色名称', trigger: 'blur' },
      { min: 2, max: 50, message: '角色名称长度为 2-50 个字符', trigger: 'blur' },
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
          <h2>角色管理</h2>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog"> 新增角色 </el-button>
        </div>
      </template>

      <!-- Roles Table -->
      <el-table v-if="roles.length > 0" :data="roles" stripe class="roles-table">
        <el-table-column prop="name" label="角色名称" min-width="140">
          <template #default="{ row }">
            <div class="role-name">
              <el-icon class="role-icon"><Key /></el-icon>
              <span class="name-text">{{ row.name }}</span>
              <el-tag v-if="row.isSuperAdmin" type="danger" size="small" class="super-tag">
                超级管理员
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="description" label="描述" min-width="200">
          <template #default="{ row }">
            {{ row.description || '-' }}
          </template>
        </el-table-column>

        <el-table-column prop="isSuperAdmin" label="超管" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isSuperAdmin ? 'danger' : 'info'" size="small">
              {{ row.isSuperAdmin ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="权限数量" width="100" align="center">
          <template #default="{ row }">
            <el-tag type="primary" size="small">
              {{ row.permissions?.length || 0 }}
            </el-tag>
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
              <el-button
                type="primary"
                size="small"
                :icon="Edit"
                :disabled="row.isSuperAdmin"
                @click="openEditDialog(row)"
              >
                编辑
              </el-button>
              <el-popconfirm
                v-if="!row.isSuperAdmin"
                title="确定要删除该角色吗？"
                confirm-button-text="确定"
                cancel-button-text="取消"
                @confirm="handleDelete(row.id)"
              >
                <template #reference>
                  <el-button type="danger" size="small" :icon="Delete">删除</el-button>
                </template>
              </el-popconfirm>
              <el-tooltip v-else content="超级管理员角色不可删除" placement="top">
                <el-button type="danger" size="small" :icon="Delete" disabled>删除</el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty v-else description="暂无角色数据">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          添加第一个角色
        </el-button>
      </el-empty>
    </el-card>

    <!-- Create/Edit Role Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="680px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="roleFormRef"
        :model="roleForm"
        :rules="formRules()"
        label-width="80px"
        label-position="top"
      >
        <el-form-item label="角色名称" prop="name">
          <el-input
            v-model="roleForm.name"
            placeholder="请输入角色名称"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="roleForm.description"
            type="textarea"
            placeholder="请输入角色描述"
            :rows="2"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="权限分配">
          <div class="permission-wrapper">
            <div class="permission-header">
              <span class="permission-count">
                已选择 {{ roleForm.permissionIds.length }} 个权限
              </span>
              <el-button
                size="small"
                :icon="Refresh"
                @click="
                  () => {
                    expandedGroups = Object.keys(groupedPermissions);
                  }
                "
              >
                展开全部
              </el-button>
            </div>
            <el-collapse v-model="expandedGroups" class="permission-collapse">
              <el-collapse-item
                v-for="(perms, resource) in groupedPermissions"
                :key="resource"
                :name="resource"
              >
                <template #title>
                  <div class="collapse-title">
                    <span class="resource-name">{{ resource }}</span>
                    <el-tag size="small" type="info">{{ perms.length }}</el-tag>
                  </div>
                </template>
                <el-checkbox-group v-model="roleForm.permissionIds" class="permission-group">
                  <el-checkbox
                    v-for="perm in perms"
                    :key="perm.id"
                    :value="perm.id"
                    class="permission-checkbox"
                  >
                    <span class="permission-action">{{ perm.action }}</span>
                    <span v-if="perm.description" class="permission-desc">
                      {{ perm.description }}
                    </span>
                  </el-checkbox>
                </el-checkbox-group>
              </el-collapse-item>
            </el-collapse>
          </div>
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

.super-tag {
  margin-left: 4px;
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

.action-buttons .el-button--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.action-buttons .el-button--danger {
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.action-buttons .el-button--danger:hover:not(:disabled) {
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

/* Permission Assignment Styles */
.permission-wrapper {
  width: 100%;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}

.permission-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
}

.permission-count {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
}

.permission-collapse {
  border: none;
  max-height: 400px;
  overflow-y: auto;
}

.permission-collapse :deep(.el-collapse-item__header) {
  background-color: #fafafa;
  padding: 0 16px;
  height: 44px;
  line-height: 44px;
  border-bottom: 1px solid #ebeef5;
}

.permission-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: none;
}

.permission-collapse :deep(.el-collapse-item__content) {
  padding: 12px 16px;
}

.collapse-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resource-name {
  font-weight: 500;
  color: #303133;
  text-transform: capitalize;
}

.permission-group {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 24px;
}

.permission-checkbox {
  margin-right: 0 !important;
  min-width: 120px;
}

.permission-checkbox :deep(.el-checkbox__label) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.permission-action {
  font-weight: 500;
  color: #303133;
}

.permission-desc {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
