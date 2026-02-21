<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Plus, Delete, Search, Refresh, FolderOpened, Folder } from '@element-plus/icons-vue';
import { getPermissions, createPermission, deletePermission } from '@/api/permission';
import { extractApiError } from '@/api';
import type { Permission, CreatePermissionDto } from '@/types/permission';

// ============================================
// i18n
// ============================================
const { t } = useI18n();

// ============================================
// State
// ============================================
const loading = ref(false);
const permissions = ref<Permission[]>([]);
const expandedGroups = ref<string[]>([]);

// Search
const searchKeyword = ref('');

// Create permission dialog
const dialogVisible = ref(false);
const formRef = ref();
const form = reactive<CreatePermissionDto>({
  name: '',
  resource: '',
  action: '',
  description: '',
});
const formLoading = ref(false);

// ============================================
// Computed
// ============================================
// Group permissions by resource
const groupedPermissions = computed(() => {
  const groups: Record<string, Permission[]> = {};

  const filtered = searchKeyword.value.trim()
    ? permissions.value.filter(
        (p) =>
          p.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
          p.resource.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
          p.action.toLowerCase().includes(searchKeyword.value.toLowerCase())
      )
    : permissions.value;

  filtered.forEach((permission) => {
    if (!groups[permission.resource]) {
      groups[permission.resource] = [];
    }
    groups[permission.resource].push(permission);
  });

  // Sort resources alphabetically
  const sortedGroups: Record<string, Permission[]> = {};
  Object.keys(groups)
    .sort()
    .forEach((key) => {
      sortedGroups[key] = groups[key].sort((a, b) => a.action.localeCompare(b.action));
    });

  return sortedGroups;
});

const resourceCount = computed(() => Object.keys(groupedPermissions.value).length);

const isAllExpanded = computed(() => {
  const resources = Object.keys(groupedPermissions.value);
  return resources.length > 0 && expandedGroups.value.length === resources.length;
});

// Auto-generate permission name
const autoPermissionName = computed(() => {
  if (form.resource && form.action) {
    return `${form.resource}:${form.action}`;
  }
  return '';
});

// ============================================
// Functions
// ============================================
async function fetchPermissions() {
  loading.value = true;
  try {
    const response = await getPermissions();
    permissions.value = response.data.data;
    // Expand all groups by default
    expandedGroups.value = Object.keys(groupedPermissions.value);
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  // Re-filter is handled by computed property
  // Just expand matching groups
  expandedGroups.value = Object.keys(groupedPermissions.value);
}

function handleReset() {
  searchKeyword.value = '';
  expandedGroups.value = Object.keys(groupedPermissions.value);
}

function toggleAllGroups() {
  const resources = Object.keys(groupedPermissions.value);
  if (isAllExpanded.value) {
    expandedGroups.value = [];
  } else {
    expandedGroups.value = resources;
  }
}

function openCreateDialog() {
  form.name = '';
  form.resource = '';
  form.action = '';
  form.description = '';
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
    // Auto-generate name if not provided
    const dto: CreatePermissionDto = {
      name: form.name || autoPermissionName.value,
      resource: form.resource,
      action: form.action,
      description: form.description || undefined,
    };

    await createPermission(dto);
    ElMessage.success(t('permissions.createSuccess'));
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
    ElMessage.success(t('permissions.deleteSuccess'));
    fetchPermissions();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

function formRules() {
  return {
    resource: [
      { required: true, message: t('permissions.resourceRequired'), trigger: 'blur' },
      { min: 1, max: 100, message: '资源长度为 1-100 个字符', trigger: 'blur' },
    ],
    action: [
      { required: true, message: t('permissions.actionRequired'), trigger: 'blur' },
      { min: 1, max: 50, message: '操作长度为 1-50 个字符', trigger: 'blur' },
    ],
  };
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchPermissions();
});
</script>

<template>
  <div class="permissions-page">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <h2>{{ t('permissions.title') }}</h2>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">
            {{ t('permissions.create') }}
          </el-button>
        </div>
      </template>

      <!-- Search Bar -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          :placeholder="t('permissions.searchPlaceholder')"
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
        <el-button :icon="Refresh" @click="handleReset">
          {{ t('common.reset') }}
        </el-button>
        <div class="flex-spacer"></div>
        <el-button
          v-if="resourceCount > 0"
          :icon="isAllExpanded ? Folder : FolderOpened"
          @click="toggleAllGroups"
        >
          {{ isAllExpanded ? t('permissions.collapseAll') : t('permissions.expandAll') }}
        </el-button>
      </div>

      <!-- Permission Groups -->
      <div v-if="resourceCount > 0" class="permission-groups">
        <el-collapse v-model="expandedGroups" accordion>
          <el-collapse-item
            v-for="(perms, resource) in groupedPermissions"
            :key="resource"
            :name="resource"
          >
            <template #title>
              <div class="group-header">
                <span class="resource-icon">
                  <el-icon><FolderOpened /></el-icon>
                </span>
                <span class="resource-name">{{ resource }}</span>
                <el-tag size="small" type="info" class="count-tag">
                  {{ perms.length }} {{ t('permissions.resourceGroup') }}
                </el-tag>
              </div>
            </template>

            <el-table :data="perms" size="small" class="permission-table">
              <el-table-column prop="name" :label="t('permissions.name')" min-width="180">
                <template #default="{ row }">
                  <code class="permission-name">{{ row.name }}</code>
                </template>
              </el-table-column>

              <el-table-column prop="action" :label="t('permissions.action')" width="120">
                <template #default="{ row }">
                  <el-tag size="small" effect="plain">{{ row.action }}</el-tag>
                </template>
              </el-table-column>

              <el-table-column
                prop="description"
                :label="t('permissions.description')"
                min-width="200"
              >
                <template #default="{ row }">
                  <span v-if="row.description" class="description-text">{{ row.description }}</span>
                  <span v-else class="no-data">-</span>
                </template>
              </el-table-column>

              <el-table-column :label="t('common.delete')" width="100" align="center">
                <template #default="{ row }">
                  <el-popconfirm
                    :title="t('permissions.deleteConfirm')"
                    :confirm-button-text="t('common.confirm')"
                    :cancel-button-text="t('common.cancel')"
                    @confirm="handleDelete(row.id)"
                  >
                    <template #reference>
                      <el-button type="danger" size="small" :icon="Delete" circle />
                    </template>
                  </el-popconfirm>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </div>

      <!-- Empty State -->
      <el-empty v-else :description="t('permissions.emptyGroup')">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          {{ t('permissions.create') }}
        </el-button>
      </el-empty>
    </el-card>

    <!-- Create Permission Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="t('permissions.create')"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules()"
        label-width="100px"
        label-position="top"
      >
        <el-form-item :label="t('permissions.resource')" prop="resource">
          <el-input
            v-model="form.resource"
            placeholder="例如: user, role, permission"
            maxlength="100"
            show-word-limit
            @input="form.name = autoPermissionName"
          />
        </el-form-item>

        <el-form-item :label="t('permissions.action')" prop="action">
          <el-input
            v-model="form.action"
            placeholder="例如: read, write, delete"
            maxlength="50"
            show-word-limit
            @input="form.name = autoPermissionName"
          />
        </el-form-item>

        <el-form-item :label="t('permissions.name')">
          <el-input
            v-model="form.name"
            :placeholder="autoPermissionName || '自动生成: resource:action'"
            maxlength="150"
            show-word-limit
          />
          <div class="form-tip">权限名称默认为 <code>资源:操作</code> 格式，可自定义修改</div>
        </el-form-item>

        <el-form-item :label="t('permissions.description')">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入权限描述（可选）"
            maxlength="255"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="formLoading" @click="handleSubmit">
          {{ t('common.save') }}
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

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
  align-items: center;
}

.search-input {
  width: 300px;
}

.flex-spacer {
  flex: 1;
}

/* Collapse Styles */
.permission-groups {
  margin-top: 8px;
}

:deep(.el-collapse) {
  border: none;
}

:deep(.el-collapse-item__header) {
  height: 56px;
  line-height: 56px;
  background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
  border-radius: 8px;
  padding: 0 16px;
  margin-bottom: 8px;
  border: 1px solid #e4e7ed;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.3s ease;
}

:deep(.el-collapse-item__header:hover) {
  background: linear-gradient(135deg, #eef1f6 0%, #dde2ea 100%);
  border-color: #c0c4cc;
}

:deep(.el-collapse-item__header.is-active) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-color: transparent;
  border-radius: 8px 8px 0 0;
  margin-bottom: 0;
}

:deep(.el-collapse-item__header.is-active .resource-icon),
:deep(.el-collapse-item__header.is-active .resource-name),
:deep(.el-collapse-item__header.is-active .count-tag) {
  color: #fff;
}

:deep(.el-collapse-item__header.is-active .count-tag) {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}

:deep(.el-collapse-item__wrap) {
  border: 1px solid #e4e7ed;
  border-top: none;
  border-radius: 0 0 8px 8px;
  margin-bottom: 8px;
  overflow: hidden;
}

:deep(.el-collapse-item__content) {
  padding: 0;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.resource-icon {
  display: flex;
  align-items: center;
  color: #667eea;
  font-size: 18px;
}

.resource-name {
  font-weight: 600;
  color: #1a1a2e;
}

.count-tag {
  margin-left: auto;
  margin-right: 8px;
}

/* Table Styles */
.permission-table {
  width: 100%;
}

.permission-table :deep(.el-table__header th) {
  background-color: #fafafa;
  font-weight: 600;
  color: #1a1a2e;
}

.permission-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.permission-table :deep(.el-table__row:hover > td) {
  background-color: #f5f7fa !important;
}

.permission-name {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 13px;
  color: #667eea;
  background: rgba(102, 126, 234, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.description-text {
  color: #606266;
  font-size: 14px;
}

.no-data {
  color: #c0c4cc;
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

.form-tip {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.form-tip code {
  background: #f5f7fa;
  padding: 1px 6px;
  border-radius: 3px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  color: #667eea;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}

/* Button hover effects */
:deep(.el-button--danger.is-circle) {
  transition: all 0.2s ease;
}

:deep(.el-button--danger.is-circle:hover) {
  transform: scale(1.1);
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.4);
}
</style>
