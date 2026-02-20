<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Edit, Delete, Lock, Search, RefreshRight } from '@element-plus/icons-vue';
import { getPermissions, createPermission, updatePermission, deletePermission } from '@/api/rbac';
import { getPolicies } from '@/api/policy';
import { extractApiError } from '@/api';
import type {
  PermissionWithPolicies,
  CreatePermissionDto,
  UpdatePermissionDto,
} from '@/types/rbac';
import type { Policy } from '@/types/policy';

// ============================================
// State
// ============================================
const loading = ref(false);
const permissions = ref<PermissionWithPolicies[]>([]);
const policies = ref<Policy[]>([]);

// Filter state
const filters = reactive({
  search: '',
  resource: '',
  action: '',
});

// Permission form dialog
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const formRef = ref();
const formLoading = ref(false);

const formData = reactive<CreatePermissionDto & { id?: string }>({
  name: '',
  resource: '',
  action: '',
  description: '',
  policyIds: [],
});

// ============================================
// Computed
// ============================================
const dialogTitle = computed(() =>
  dialogMode.value === 'create' ? 'Create Permission' : 'Edit Permission'
);

const policyOptions = computed(() =>
  policies.value.map((p) => ({
    value: p.id,
    label: `${p.name} (${p.effect === 'allow' ? 'Allow' : 'Deny'})`,
  }))
);

const filteredPermissions = computed(() => {
  let result = permissions.value;

  if (filters.search.trim()) {
    const search = filters.search.toLowerCase();
    result = result.filter(
      (p) => p.name.toLowerCase().includes(search) || p.description?.toLowerCase().includes(search)
    );
  }

  if (filters.resource.trim()) {
    result = result.filter((p) =>
      p.resource.toLowerCase().includes(filters.resource.toLowerCase())
    );
  }

  if (filters.action.trim()) {
    result = result.filter((p) => p.action.toLowerCase().includes(filters.action.toLowerCase()));
  }

  return result;
});

// ============================================
// Data Fetching
// ============================================
async function fetchPermissions() {
  loading.value = true;
  try {
    const response = await getPermissions();
    permissions.value = response.data as PermissionWithPolicies[];
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

async function fetchPolicies() {
  try {
    // Fetch all policies without pagination limit
    const response = await getPolicies({ limit: 1000 });
    policies.value = response.data;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

// ============================================
// Dialog Functions
// ============================================
function resetForm() {
  formData.id = undefined;
  formData.name = '';
  formData.resource = '';
  formData.action = '';
  formData.description = '';
  formData.policyIds = [];
}

function openCreateDialog() {
  dialogMode.value = 'create';
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(permission: PermissionWithPolicies) {
  dialogMode.value = 'edit';
  formData.id = permission.id;
  formData.name = permission.name;
  formData.resource = permission.resource;
  formData.action = permission.action;
  formData.description = permission.description || '';
  formData.policyIds = permission.policies?.map((p) => p.id) || [];
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
    const submitData: CreatePermissionDto | UpdatePermissionDto = {
      name: formData.name,
      resource: formData.resource,
      action: formData.action,
      description: formData.description || undefined,
      policyIds: formData.policyIds,
    };

    if (dialogMode.value === 'create') {
      await createPermission(submitData as CreatePermissionDto);
      ElMessage.success('Permission created successfully');
    } else if (formData.id) {
      await updatePermission(formData.id, submitData as UpdatePermissionDto);
      ElMessage.success('Permission updated successfully');
    }
    dialogVisible.value = false;
    fetchPermissions();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    formLoading.value = false;
  }
}

async function handleDelete(permissionId: string) {
  try {
    await deletePermission(permissionId);
    ElMessage.success('Permission deleted successfully');
    fetchPermissions();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

// ============================================
// Filter Functions
// ============================================
function handleSearch() {
  // Filtering is handled by computed property
}

function handleReset() {
  filters.search = '';
  filters.resource = '';
  filters.action = '';
}

// ============================================
// Utility Functions
// ============================================
function formRules() {
  return {
    name: [
      { required: true, message: 'Please enter permission name', trigger: 'blur' },
      { min: 2, max: 100, message: 'Name must be 2-100 characters', trigger: 'blur' },
    ],
    resource: [
      { required: true, message: 'Please enter resource', trigger: 'blur' },
      { max: 100, message: 'Resource must be at most 100 characters', trigger: 'blur' },
    ],
    action: [
      { required: true, message: 'Please enter action', trigger: 'blur' },
      { max: 50, message: 'Action must be at most 50 characters', trigger: 'blur' },
    ],
  };
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchPermissions();
  fetchPolicies();
});
</script>

<template>
  <div class="permissions-page">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <h2>Permission Management</h2>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">
            Create Permission
          </el-button>
        </div>
      </template>

      <!-- Filter Section -->
      <div class="filter-section">
        <el-form :inline="true" class="filter-form">
          <el-form-item label="Search">
            <el-input
              v-model="filters.search"
              placeholder="Search by name or description"
              clearable
              style="width: 220px"
              @keyup.enter="handleSearch"
            />
          </el-form-item>

          <el-form-item label="Resource">
            <el-input
              v-model="filters.resource"
              placeholder="Filter by resource"
              clearable
              style="width: 160px"
              @keyup.enter="handleSearch"
            />
          </el-form-item>

          <el-form-item label="Action">
            <el-input
              v-model="filters.action"
              placeholder="Filter by action"
              clearable
              style="width: 120px"
              @keyup.enter="handleSearch"
            />
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :icon="Search" @click="handleSearch"> Search </el-button>
            <el-button :icon="RefreshRight" @click="handleReset"> Reset </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- Permission Table -->
      <el-table
        v-if="filteredPermissions.length > 0"
        :data="filteredPermissions"
        stripe
        class="permissions-table"
      >
        <el-table-column prop="name" label="Permission Name" min-width="160">
          <template #default="{ row }">
            <div class="permission-name">
              <el-icon class="permission-icon"><Lock /></el-icon>
              <span class="name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="resource" label="Resource" min-width="140">
          <template #default="{ row }">
            <code class="code-tag">{{ row.resource }}</code>
          </template>
        </el-table-column>

        <el-table-column prop="action" label="Action" min-width="100">
          <template #default="{ row }">
            <code class="code-tag">{{ row.action }}</code>
          </template>
        </el-table-column>

        <el-table-column prop="description" label="Description" min-width="200">
          <template #default="{ row }">
            <span class="description-text">{{ row.description || '-' }}</span>
          </template>
        </el-table-column>

        <el-table-column label="Policies" min-width="180">
          <template #default="{ row }">
            <div class="policy-tags">
              <el-tag
                v-for="policy in row.policies?.slice(0, 2)"
                :key="policy.id"
                size="small"
                class="policy-tag"
              >
                {{ policy.name }}
              </el-tag>
              <el-tag v-if="row.policies?.length > 2" size="small" type="info" class="more-tag">
                +{{ row.policies.length - 2 }} more
              </el-tag>
              <span v-if="!row.policies?.length" class="no-policies"> No policies </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Actions" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" :icon="Edit" @click="openEditDialog(row)">
                Edit
              </el-button>
              <el-popconfirm
                title="Are you sure you want to delete this permission?"
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
      <el-empty v-else description="No permissions found">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          Create First Permission
        </el-button>
      </el-empty>
    </el-card>

    <!-- Create/Edit Permission Dialog -->
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
        <el-form-item label="Permission Name" prop="name">
          <el-input
            v-model="formData.name"
            placeholder="e.g., User Read, Article Delete"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="Resource" prop="resource">
              <el-input
                v-model="formData.resource"
                placeholder="e.g., user, article, policy"
                maxlength="100"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Action" prop="action">
              <el-input
                v-model="formData.action"
                placeholder="e.g., read, create, delete"
                maxlength="50"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="Description">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="Describe what this permission allows"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="Associated Policies">
          <el-select
            v-model="formData.policyIds"
            multiple
            filterable
            placeholder="Select policies to associate"
            class="policy-select"
          >
            <el-option
              v-for="option in policyOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
          <div class="form-hint">Select policies that should grant this permission to users</div>
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
.permissions-page {
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

/* Filter Section */
.filter-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Table Styles */
.permissions-table {
  width: 100%;
}

.permissions-table :deep(.el-table__header th) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #1a1a2e;
}

.permissions-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.permissions-table :deep(.el-table__row:hover > td) {
  background-color: #f5f7fa !important;
}

.permission-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.permission-icon {
  color: #667eea;
  font-size: 16px;
}

.name-text {
  font-weight: 500;
  color: #1a1a2e;
}

.code-tag {
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  padding: 4px 10px;
  border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: #606266;
}

.description-text {
  color: #606266;
  font-size: 13px;
}

.policy-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.policy-tag {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #fff;
}

.more-tag {
  background: #f0f0f0;
  border: none;
}

.no-policies {
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

.policy-select {
  width: 100%;
}

.form-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
