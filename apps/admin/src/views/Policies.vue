<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Edit, Delete, Search, Refresh, Key } from '@element-plus/icons-vue';
import {
  getPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getSubjectTypes,
  getSubjectValues,
  getResources,
  getActions,
} from '@/api/policy';
import { extractApiError } from '@/api';
import type {
  Policy,
  CreatePolicyDto,
  UpdatePolicyDto,
  QueryPolicyDto,
  PolicySubject,
} from '@/types/permission';
import { PolicyEffect } from '@/types/permission';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

// ============================================
// State
// ============================================
const loading = ref(false);
const policies = ref<Policy[]>([]);
const total = ref(0);
const pagination = reactive({
  limit: 10,
  offset: 0,
});

// Search and filter
const searchKeyword = ref('');
const filterEnabled = ref<boolean | ''>('');

// Policy form dialog
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const policyFormRef = ref();
const policyForm = reactive<{
  id?: string;
  name: string;
  description: string;
  effect: PolicyEffect;
  subject: PolicySubject;
  resource: string;
  action: string;
  conditions: Record<string, unknown> | undefined;
  priority: number;
  enabled: boolean;
}>({
  name: '',
  description: '',
  effect: PolicyEffect.ALLOW,
  subject: { type: 'role', value: [] },
  resource: '',
  action: '',
  conditions: undefined,
  priority: 0,
  enabled: true,
});
const conditionsText = ref('');
const conditionsError = ref('');
const formLoading = ref(false);

// Subject type and value selectors
const subjectTypes = ref<Array<{ type: string; label: string }>>([]);
const subjectValues = ref<Array<{ id: string; label: string }>>([]);
const resources = ref<string[]>([]);
const actions = ref<string[]>([]);
const loadingSubjectTypes = ref(false);
const loadingSubjectValues = ref(false);
const loadingResources = ref(false);
const loadingActions = ref(false);

// Computed for subject value disabled state
const isSubjectValueDisabled = computed(() => policyForm.subject.type === 'all');

// ============================================
// Computed
// ============================================
const dialogTitle = computed(() =>
  dialogMode.value === 'create' ? t('policies.create') : t('policies.edit')
);

const currentPage = computed({
  get: () => Math.floor(pagination.offset / pagination.limit) + 1,
  set: (val: number) => {
    pagination.offset = (val - 1) * pagination.limit;
  },
});

// ============================================
// Subject/Resource/Action Loaders
// ============================================
async function loadSubjectTypes() {
  loadingSubjectTypes.value = true;
  try {
    const response = await getSubjectTypes();
    subjectTypes.value = response.data.types;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loadingSubjectTypes.value = false;
  }
}

async function loadSubjectValues(type: string) {
  loadingSubjectValues.value = true;
  try {
    const response = await getSubjectValues(type);
    // Add wildcard '*' option at the beginning for all types
    subjectValues.value = [
      { id: '*', label: '*' },
      ...response.data.values,
    ];
    // Auto-select '*' for 'all' type
    if (type === 'all') {
      policyForm.subject.value = ['*'];
    }
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loadingSubjectValues.value = false;
  }
}

async function loadResources() {
  loadingResources.value = true;
  try {
    const response = await getResources();
    // Backend already includes '*' in the response
    resources.value = response.data.resources;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loadingResources.value = false;
  }
}

async function loadActions() {
  loadingActions.value = true;
  try {
    const response = await getActions();
    // Backend already includes '*' in the response
    actions.value = response.data.actions;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loadingActions.value = false;
  }
}

// Watch subject type change to load corresponding values
watch(
  () => policyForm.subject.type,
  (newType) => {
    policyForm.subject.value = [];
    loadSubjectValues(newType);
  }
);

// ============================================
// Policy CRUD Functions
// ============================================
async function fetchPolicies() {
  loading.value = true;
  try {
    const params: QueryPolicyDto = {
      limit: pagination.limit,
      page: Math.floor(pagination.offset / pagination.limit) + 1,
    };
    if (searchKeyword.value.trim()) {
      params.keyword = searchKeyword.value.trim();
    }
    if (filterEnabled.value !== '') {
      params.enabled = filterEnabled.value;
    }

    const response = await getPolicies(params);
    policies.value = response.data.data;
    total.value = response.data.total;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pagination.offset = 0;
  fetchPolicies();
}

function handleReset() {
  searchKeyword.value = '';
  filterEnabled.value = '';
  pagination.offset = 0;
  fetchPolicies();
}

function handlePageChange(page: number) {
  currentPage.value = page;
  fetchPolicies();
}

function handleSizeChange(size: number) {
  pagination.limit = size;
  pagination.offset = 0;
  fetchPolicies();
}

async function openCreateDialog() {
  dialogMode.value = 'create';
  policyForm.id = undefined;
  policyForm.name = '';
  policyForm.description = '';
  policyForm.effect = PolicyEffect.ALLOW;
  policyForm.subject = { type: 'role', value: [] };
  policyForm.resource = '';
  policyForm.action = '';
  policyForm.conditions = undefined;
  policyForm.priority = 0;
  policyForm.enabled = true;
  conditionsText.value = '';
  conditionsError.value = '';

  // Load dropdown data
  await Promise.all([loadSubjectTypes(), loadResources(), loadActions()]);
  await loadSubjectValues('role');

  dialogVisible.value = true;
}

async function openEditDialog(policy: Policy) {
  dialogMode.value = 'edit';
  policyForm.id = policy.id;
  policyForm.name = policy.name;
  policyForm.description = policy.description || '';
  policyForm.effect = policy.effect;

  // Handle subject parsing - could be string or object
  if (typeof policy.subject === 'string') {
    policyForm.subject = { type: 'role', value: [policy.subject] };
  } else {
    policyForm.subject = {
      type: policy.subject.type,
      value: Array.isArray(policy.subject.value) ? policy.subject.value : [policy.subject.value],
    };
  }

  policyForm.resource = policy.resource;
  policyForm.action = policy.action;
  policyForm.conditions = policy.conditions || undefined;
  policyForm.priority = policy.priority;
  policyForm.enabled = policy.enabled;
  conditionsText.value = policy.conditions ? JSON.stringify(policy.conditions, null, 2) : '';
  conditionsError.value = '';

  // Load dropdown data
  await Promise.all([loadSubjectTypes(), loadResources(), loadActions()]);
  await loadSubjectValues(policyForm.subject.type);

  dialogVisible.value = true;
}

function validateConditions(): boolean {
  conditionsError.value = '';

  if (!conditionsText.value.trim()) {
    policyForm.conditions = undefined;
    return true;
  }

  try {
    const parsed = JSON.parse(conditionsText.value);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      conditionsError.value = t('policies.conditionsInvalid');
      return false;
    }
    policyForm.conditions = parsed;
    return true;
  } catch {
    conditionsError.value = t('policies.conditionsInvalid');
    return false;
  }
}

async function handleSubmit() {
  if (!policyFormRef.value) return;

  try {
    await policyFormRef.value.validate();
  } catch {
    return;
  }

  if (!validateConditions()) {
    return;
  }

  // Build subject object
  const subjectData: PolicySubject = {
    type: policyForm.subject.type,
    value: policyForm.subject.type === 'all' ? '*' : policyForm.subject.value,
  };

  formLoading.value = true;
  try {
    if (dialogMode.value === 'create') {
      const dto: CreatePolicyDto = {
        name: policyForm.name,
        description: policyForm.description || undefined,
        effect: policyForm.effect,
        subject: subjectData,
        resource: policyForm.resource,
        action: policyForm.action,
        conditions: policyForm.conditions,
        priority: policyForm.priority,
        enabled: policyForm.enabled,
      };
      await createPolicy(dto);
      ElMessage.success(t('policies.createSuccess'));
    } else if (policyForm.id) {
      const dto: UpdatePolicyDto = {
        name: policyForm.name,
        description: policyForm.description || null,
        effect: policyForm.effect,
        subject: subjectData,
        resource: policyForm.resource,
        action: policyForm.action,
        conditions: policyForm.conditions || null,
        priority: policyForm.priority,
        enabled: policyForm.enabled,
      };
      await updatePolicy(policyForm.id, dto);
      ElMessage.success(t('policies.updateSuccess'));
    }
    dialogVisible.value = false;
    fetchPolicies();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    formLoading.value = false;
  }
}

async function handleDelete(policyId: string) {
  try {
    await deletePolicy(policyId);
    ElMessage.success(t('policies.deleteSuccess'));
    fetchPolicies();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

async function handleEnableChange(policy: Policy, enabled: boolean) {
  try {
    await updatePolicy(policy.id, { enabled });
    ElMessage.success(enabled ? t('policies.enabled') : t('policies.disabled'));
    fetchPolicies();
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

function getEffectType(effect: PolicyEffect): 'success' | 'danger' {
  return effect === 'allow' ? 'success' : 'danger';
}

function getEffectText(effect: PolicyEffect): string {
  return effect === 'allow' ? t('policies.effectAllow') : t('policies.effectDeny');
}

function formRules() {
  return {
    name: [{ required: true, message: t('policies.nameRequired'), trigger: 'blur' }],
    'subject.type': [
      { required: true, message: t('policies.subjectTypeRequired'), trigger: 'change' },
    ],
    'subject.value': [
      {
        validator: (_rule: unknown, value: string[], callback: (error?: Error) => void) => {
          if (!value || value.length === 0) {
            callback(new Error(t('policies.subjectValueRequired')));
          } else {
            callback();
          }
        },
        trigger: 'change',
      },
    ],
    resource: [{ required: true, message: t('policies.resourceRequired'), trigger: 'change' }],
    action: [{ required: true, message: t('policies.actionRequired'), trigger: 'change' }],
  };
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchPolicies();
});
</script>

<template>
  <div class="policies-page">
    <el-card v-loading="loading" class="page-card">
      <template #header>
        <div class="card-header">
          <h2>{{ t('policies.title') }}</h2>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">
            {{ t('policies.create') }}
          </el-button>
        </div>
      </template>

      <!-- Search and Filter -->
      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          :placeholder="t('policies.searchPlaceholder')"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-select
          v-model="filterEnabled"
          :placeholder="t('policies.status')"
          clearable
          class="status-select"
        >
          <el-option :label="t('policies.enabled')" :value="true" />
          <el-option :label="t('policies.disabled')" :value="false" />
        </el-select>
        <el-button type="primary" :icon="Search" @click="handleSearch">
          {{ t('common.search') }}
        </el-button>
        <el-button :icon="Refresh" @click="handleReset">
          {{ t('common.reset') }}
        </el-button>
      </div>

      <!-- Policy Table -->
      <el-table v-if="policies.length > 0" :data="policies" stripe class="policies-table">
        <el-table-column prop="name" :label="t('policies.name')" min-width="140">
          <template #default="{ row }">
            <div class="policy-name">
              <el-icon class="policy-icon"><Key /></el-icon>
              <span class="name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="effect" :label="t('policies.effect')" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="getEffectType(row.effect)" size="small">
              {{ getEffectText(row.effect) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="subject" :label="t('policies.subject')" min-width="120">
          <template #default="{ row }">
            <el-tag type="info" size="small" effect="plain">
              {{
                typeof row.subject === 'string'
                  ? row.subject
                  : `${row.subject.type}:${Array.isArray(row.subject.value) ? row.subject.value.join(',') : row.subject.value}`
              }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="resource" :label="t('policies.resource')" min-width="120">
          <template #default="{ row }">
            <el-tag type="warning" size="small" effect="plain">{{ row.resource }}</el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="action" :label="t('policies.action')" min-width="100">
          <template #default="{ row }">
            <code class="action-code">{{ row.action }}</code>
          </template>
        </el-table-column>

        <el-table-column prop="priority" :label="t('policies.priority')" width="80" align="center">
          <template #default="{ row }">
            <span class="priority-badge">{{ row.priority }}</span>
          </template>
        </el-table-column>

        <el-table-column prop="enabled" :label="t('policies.status')" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.enabled"
              size="small"
              @change="(val: boolean) => handleEnableChange(row, val)"
            />
          </template>
        </el-table-column>

        <el-table-column :label="t('policies.createdAt')" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column :label="t('common.edit')" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button type="primary" size="small" :icon="Edit" @click="openEditDialog(row)">
                {{ t('common.edit') }}
              </el-button>
              <el-popconfirm
                :title="t('policies.deleteConfirm')"
                :confirm-button-text="t('common.confirm')"
                :cancel-button-text="t('common.cancel')"
                @confirm="handleDelete(row.id)"
              >
                <template #reference>
                  <el-button type="danger" size="small" :icon="Delete">
                    {{ t('common.delete') }}
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty v-else :description="t('common.noData')">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          {{ t('policies.create') }}
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

    <!-- Create/Edit Policy Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="policyFormRef"
        :model="policyForm"
        :rules="formRules()"
        label-width="100px"
        label-position="top"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('policies.name')" prop="name">
              <el-input
                v-model="policyForm.name"
                :placeholder="t('policies.name')"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('policies.effect')" prop="effect">
              <el-select v-model="policyForm.effect" class="full-width">
                <el-option :label="t('policies.effectAllow')" value="allow" />
                <el-option :label="t('policies.effectDeny')" value="deny" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="t('policies.description')">
          <el-input
            v-model="policyForm.description"
            type="textarea"
            :rows="2"
            :placeholder="t('policies.description')"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('policies.subjectType')" prop="subject.type">
              <el-select
                v-model="policyForm.subject.type"
                :placeholder="t('policies.selectSubjectType')"
                :loading="loadingSubjectTypes"
                class="full-width"
              >
                <el-option
                  v-for="item in subjectTypes"
                  :key="item.type"
                  :label="item.label"
                  :value="item.type"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('policies.subjectValue')" prop="subject.value">
              <el-select
                v-model="policyForm.subject.value"
                :placeholder="t('policies.selectSubjectValue')"
                :loading="loadingSubjectValues"
                :disabled="isSubjectValueDisabled"
                :multiple="!isSubjectValueDisabled"
                :collapse-tags="!isSubjectValueDisabled"
                :collapse-tags-tooltip="!isSubjectValueDisabled"
                class="full-width"
              >
                <el-option
                  v-for="item in subjectValues"
                  :key="item.id"
                  :label="item.label"
                  :value="item.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('policies.resource')" prop="resource">
              <el-select
                v-model="policyForm.resource"
                :placeholder="t('policies.selectResource')"
                :loading="loadingResources"
                filterable
                class="full-width"
              >
                <el-option v-for="item in resources" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('policies.action')" prop="action">
              <el-select
                v-model="policyForm.action"
                :placeholder="t('policies.selectAction')"
                :loading="loadingActions"
                filterable
                class="full-width"
              >
                <el-option v-for="item in actions" :key="item" :label="item" :value="item" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="t('policies.conditions')">
          <el-input
            v-model="conditionsText"
            type="textarea"
            :rows="4"
            :placeholder="t('policies.conditionsPlaceholder')"
            :class="{ 'is-error': conditionsError }"
          />
          <div v-if="conditionsError" class="conditions-error">
            {{ conditionsError }}
          </div>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('policies.priority')">
              <el-input-number
                v-model="policyForm.priority"
                :min="0"
                :max="9999"
                controls-position="right"
                class="full-width"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('policies.enabled')">
              <el-switch
                v-model="policyForm.enabled"
                :active-text="t('policies.enabled')"
                :inactive-text="t('policies.disabled')"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" :loading="formLoading" @click="handleSubmit">
          {{ dialogMode === 'create' ? t('common.add') : t('common.save') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.policies-page {
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
  width: 300px;
}

.status-select {
  width: 140px;
}

.policies-table {
  width: 100%;
}

.policies-table :deep(.el-table__header th) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #1a1a2e;
}

.policies-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.policies-table :deep(.el-table__row:hover > td) {
  background-color: #f5f7fa !important;
}

.policy-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.policy-icon {
  color: #667eea;
  font-size: 16px;
}

.name-text {
  font-weight: 500;
  color: #1a1a2e;
}

.action-code {
  background-color: #f5f7fa;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 12px;
  color: #606266;
}

.priority-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
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

.full-width {
  width: 100%;
}

.conditions-error {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 4px;
}

:deep(.is-error .el-textarea__inner) {
  border-color: #f56c6c;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}
</style>
