<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Plus, Edit, Search, RefreshRight, Key } from '@element-plus/icons-vue';
import {
  getPolicies,
  createPolicy,
  updatePolicy,
  togglePolicyEnabled,
  deletePolicy,
} from '@/api/policy';
import { extractApiError } from '@/api';
import type {
  Policy,
  CreatePolicyDto,
  QueryPolicyDto,
  PolicyEffect,
  PolicyCondition,
  TimeCondition,
  IpCondition,
} from '@/types/policy';

// ============================================
// Types
// ============================================
interface FilterState {
  subject: string;
  resource: string;
  action: string;
  enabled: string; // 'all' | 'true' | 'false'
}

// ============================================
// State
// ============================================
const { t } = useI18n();

const loading = ref(false);
const policies = ref<Policy[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);

const filters = reactive<FilterState>({
  subject: '',
  resource: '',
  action: '',
  enabled: 'all',
});

const deleteLoading = ref<string | null>(null);

// Dialog state
const dialogVisible = ref(false);
const dialogMode = ref<'create' | 'edit'>('create');
const formRef = ref();
const formLoading = ref(false);

// Form data
const formData = reactive<CreatePolicyDto & { id?: string }>({
  name: '',
  description: '',
  effect: 'allow',
  subject: '',
  resource: '',
  action: '',
  conditions: undefined,
  priority: 0,
  enabled: true,
});

// Condition configuration state (separate UI state from conditions)
const timeEnabled = ref(false);
const ipEnabled = ref(false);
const timeConditionData = reactive({
  start: '',
  end: '',
  daysOfWeek: [] as number[],
});
const ipConditionData = reactive({
  allowed: [''] as string[],
});

// ============================================
// Computed
// ============================================
const dialogTitle = computed(() =>
  dialogMode.value === 'create'
    ? t('policies.createPolicy', 'Create Policy')
    : t('policies.editPolicy', 'Edit Policy')
);

const effectOptions = [
  { value: 'allow', label: t('policies.effectAllow', 'Allow') },
  { value: 'deny', label: t('policies.effectDeny', 'Deny') },
];

// Computed conditions object for JSON preview
const conditionsPreview = computed((): PolicyCondition | undefined => {
  const conditions: PolicyCondition = {};

  if (timeEnabled.value) {
    const timeCond: TimeCondition = {};
    if (timeConditionData.start) {
      timeCond.start = timeConditionData.start;
    }
    if (timeConditionData.end) {
      timeCond.end = timeConditionData.end;
    }
    if (timeConditionData.daysOfWeek.length > 0) {
      timeCond.daysOfWeek = [...timeConditionData.daysOfWeek].sort();
    }
    if (Object.keys(timeCond).length > 0) {
      conditions.time = timeCond;
    }
  }

  if (ipEnabled.value) {
    const ipCond: IpCondition = {};
    const validIps = ipConditionData.allowed.filter((ip) => ip.trim() !== '');
    if (validIps.length > 0) {
      ipCond.allowed = validIps;
    }
    if (Object.keys(ipCond).length > 0) {
      conditions.ip = ipCond;
    }
  }

  return Object.keys(conditions).length > 0 ? conditions : undefined;
});

const conditionsJson = computed(() => {
  if (!conditionsPreview.value) {
    return '// No conditions configured';
  }
  return JSON.stringify(conditionsPreview.value, null, 2);
});

// Day of week options for time condition
const dayOfWeekOptions = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

// ============================================
// Data Fetching
// ============================================
async function fetchPolicies() {
  loading.value = true;
  try {
    const query: QueryPolicyDto = {
      limit: pageSize.value,
      offset: (currentPage.value - 1) * pageSize.value,
    };

    // Add filters if they have values
    if (filters.subject.trim()) {
      query.subject = filters.subject.trim();
    }
    if (filters.resource.trim()) {
      query.resource = filters.resource.trim();
    }
    if (filters.action.trim()) {
      query.action = filters.action.trim();
    }
    if (filters.enabled !== 'all') {
      query.enabled = filters.enabled === 'true';
    }

    const response = await getPolicies(query);
    policies.value = response.data;
    total.value = response.total;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

async function handleToggleEnabled(policy: Policy) {
  try {
    await togglePolicyEnabled(policy.id, !policy.enabled);
    ElMessage.success(
      policy.enabled
        ? t('policies.disabledSuccess', 'Policy disabled successfully')
        : t('policies.enabledSuccess', 'Policy enabled successfully')
    );
    await fetchPolicies();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

async function handleDelete(policy: Policy) {
  deleteLoading.value = policy.id;
  try {
    await deletePolicy(policy.id);
    ElMessage.success(t('policies.deleteSuccess', 'Policy deleted successfully'));
    await fetchPolicies();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    deleteLoading.value = null;
  }
}

// ============================================
// Dialog Functions
// ============================================
function resetForm() {
  formData.id = undefined;
  formData.name = '';
  formData.description = '';
  formData.effect = 'allow';
  formData.subject = '';
  formData.resource = '';
  formData.action = '';
  formData.conditions = undefined;
  formData.priority = 0;
  formData.enabled = true;
  // Reset condition state
  timeEnabled.value = false;
  ipEnabled.value = false;
  timeConditionData.start = '';
  timeConditionData.end = '';
  timeConditionData.daysOfWeek = [];
  ipConditionData.allowed = [''];
}

function openCreateDialog() {
  dialogMode.value = 'create';
  resetForm();
  dialogVisible.value = true;
}

function openEditDialog(policy: Policy) {
  dialogMode.value = 'edit';
  formData.id = policy.id;
  formData.name = policy.name;
  formData.description = policy.description || '';
  formData.effect = policy.effect;
  formData.subject = policy.subject;
  formData.resource = policy.resource;
  formData.action = policy.action;
  formData.conditions = policy.conditions || undefined;
  formData.priority = policy.priority;
  formData.enabled = policy.enabled;

  // Parse existing conditions into UI state
  if (policy.conditions) {
    if (policy.conditions.time) {
      timeEnabled.value = true;
      timeConditionData.start = policy.conditions.time.start || '';
      timeConditionData.end = policy.conditions.time.end || '';
      timeConditionData.daysOfWeek = policy.conditions.time.daysOfWeek || [];
    } else {
      timeEnabled.value = false;
      timeConditionData.start = '';
      timeConditionData.end = '';
      timeConditionData.daysOfWeek = [];
    }
    if (policy.conditions.ip) {
      ipEnabled.value = true;
      ipConditionData.allowed = policy.conditions.ip.allowed?.length
        ? [...policy.conditions.ip.allowed]
        : [''];
    } else {
      ipEnabled.value = false;
      ipConditionData.allowed = [''];
    }
  } else {
    timeEnabled.value = false;
    ipEnabled.value = false;
    timeConditionData.start = '';
    timeConditionData.end = '';
    timeConditionData.daysOfWeek = [];
    ipConditionData.allowed = [''];
  }

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
    // Build conditions from UI state
    const conditions = conditionsPreview.value;

    if (dialogMode.value === 'create') {
      await createPolicy({
        name: formData.name,
        description: formData.description || undefined,
        effect: formData.effect,
        subject: formData.subject,
        resource: formData.resource,
        action: formData.action,
        conditions: conditions,
        priority: formData.priority,
        enabled: formData.enabled,
      });
      ElMessage.success(t('policies.createSuccess', 'Policy created successfully'));
    } else if (formData.id) {
      await updatePolicy(formData.id, {
        name: formData.name,
        description: formData.description || undefined,
        effect: formData.effect,
        subject: formData.subject,
        resource: formData.resource,
        action: formData.action,
        conditions: conditions,
        priority: formData.priority,
        enabled: formData.enabled,
      });
      ElMessage.success(t('policies.updateSuccess', 'Policy updated successfully'));
    }
    dialogVisible.value = false;
    await fetchPolicies();
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    formLoading.value = false;
  }
}

function formRules() {
  return {
    name: [
      {
        required: true,
        message: t('policies.nameRequired', 'Please enter policy name'),
        trigger: 'blur',
      },
      {
        max: 100,
        message: t('policies.nameMaxLength', 'Name must be at most 100 characters'),
        trigger: 'blur',
      },
    ],
    effect: [
      {
        required: true,
        message: t('policies.effectRequired', 'Please select effect'),
        trigger: 'change',
      },
    ],
    subject: [
      {
        required: true,
        message: t('policies.subjectRequired', 'Please enter subject'),
        trigger: 'blur',
      },
    ],
    resource: [
      {
        required: true,
        message: t('policies.resourceRequired', 'Please enter resource'),
        trigger: 'blur',
      },
    ],
    action: [
      {
        required: true,
        message: t('policies.actionRequired', 'Please enter action'),
        trigger: 'blur',
      },
    ],
  };
}

// ============================================
// Filter & Pagination Handlers
// ============================================
function handleSearch() {
  currentPage.value = 1;
  fetchPolicies();
}

function handleReset() {
  filters.subject = '';
  filters.resource = '';
  filters.action = '';
  filters.enabled = 'all';
  currentPage.value = 1;
  fetchPolicies();
}

function handlePageChange(page: number) {
  currentPage.value = page;
  fetchPolicies();
}

function handleSizeChange(size: number) {
  pageSize.value = size;
  currentPage.value = 1;
  fetchPolicies();
}

// ============================================
// Utility Functions
// ============================================
function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
}

function getEffectType(effect: PolicyEffect): 'success' | 'danger' {
  return effect === 'allow' ? 'success' : 'danger';
}

function getEffectLabel(effect: PolicyEffect): string {
  return effect === 'allow' ? t('policies.effectAllow', 'Allow') : t('policies.effectDeny', 'Deny');
}

function getEnabledType(enabled: boolean): 'success' | 'info' {
  return enabled ? 'success' : 'info';
}

function getEnabledLabel(enabled: boolean): string {
  return enabled ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled');
}

function truncateConditions(conditions: PolicyCondition | null): string {
  if (!conditions) return '-';
  const parts: string[] = [];
  if (conditions.time) parts.push('Time');
  if (conditions.ip) parts.push('IP');
  return parts.length > 0 ? parts.join(', ') : '-';
}

// ============================================
// Condition Helper Functions
// ============================================
function addIpAddress() {
  ipConditionData.allowed.push('');
}

function removeIpAddress(index: number) {
  if (ipConditionData.allowed.length > 1) {
    ipConditionData.allowed.splice(index, 1);
  } else {
    ipConditionData.allowed[0] = '';
  }
}

function clearTimeCondition() {
  timeConditionData.start = '';
  timeConditionData.end = '';
  timeConditionData.daysOfWeek = [];
}

function clearIpCondition() {
  ipConditionData.allowed = [''];
}

// Watch for filter changes to reset page
watch(
  () => [filters.subject, filters.resource, filters.action, filters.enabled],
  () => {
    // Don't auto-fetch, just reset page when filters change
    currentPage.value = 1;
  }
);

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
          <h2>{{ t('menu.policies', 'Policy Management') }}</h2>
          <el-button type="primary" :icon="Plus" @click="openCreateDialog">
            {{ t('common.add', 'Add Policy') }}
          </el-button>
        </div>
      </template>

      <!-- Filter Section -->
      <div class="filter-section">
        <el-form :inline="true" class="filter-form">
          <el-form-item :label="t('policies.subject', 'Subject')">
            <el-input
              v-model="filters.subject"
              :placeholder="t('policies.subjectPlaceholder', 'Enter subject')"
              clearable
              style="width: 180px"
              @keyup.enter="handleSearch"
            />
          </el-form-item>

          <el-form-item :label="t('policies.resource', 'Resource')">
            <el-input
              v-model="filters.resource"
              :placeholder="t('policies.resourcePlaceholder', 'Enter resource')"
              clearable
              style="width: 180px"
              @keyup.enter="handleSearch"
            />
          </el-form-item>

          <el-form-item :label="t('policies.action', 'Action')">
            <el-input
              v-model="filters.action"
              :placeholder="t('policies.actionPlaceholder', 'Enter action')"
              clearable
              style="width: 140px"
              @keyup.enter="handleSearch"
            />
          </el-form-item>

          <el-form-item :label="t('common.status', 'Status')">
            <el-select
              v-model="filters.enabled"
              :placeholder="t('common.selectStatus', 'Select status')"
              style="width: 120px"
            >
              <el-option :label="t('common.all', 'All')" value="all" />
              <el-option :label="t('common.enabled', 'Enabled')" value="true" />
              <el-option :label="t('common.disabled', 'Disabled')" value="false" />
            </el-select>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :icon="Search" @click="handleSearch">
              {{ t('common.search', 'Search') }}
            </el-button>
            <el-button :icon="RefreshRight" @click="handleReset">
              {{ t('common.reset', 'Reset') }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- Policy Table -->
      <el-table v-if="policies.length > 0" :data="policies" stripe class="policies-table">
        <el-table-column prop="name" :label="t('policies.name', 'Name')" min-width="140">
          <template #default="{ row }">
            <div class="policy-name">
              <el-icon class="policy-icon"><Key /></el-icon>
              <span class="name-text">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          prop="effect"
          :label="t('policies.effect', 'Effect')"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="getEffectType(row.effect)" size="small">
              {{ getEffectLabel(row.effect) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="subject" :label="t('policies.subject', 'Subject')" min-width="120">
          <template #default="{ row }">
            <el-tag type="info" size="small" class="subject-tag">
              {{ row.subject }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column
          prop="resource"
          :label="t('policies.resource', 'Resource')"
          min-width="120"
        >
          <template #default="{ row }">
            <code class="code-tag">{{ row.resource }}</code>
          </template>
        </el-table-column>

        <el-table-column prop="action" :label="t('policies.action', 'Action')" min-width="100">
          <template #default="{ row }">
            <code class="code-tag">{{ row.action }}</code>
          </template>
        </el-table-column>

        <el-table-column :label="t('policies.conditions', 'Conditions')" min-width="100">
          <template #default="{ row }">
            <el-tag v-if="row.conditions" type="info" size="small">
              {{ truncateConditions(row.conditions) }}
            </el-tag>
            <span v-else class="no-conditions">-</span>
          </template>
        </el-table-column>

        <el-table-column
          prop="priority"
          :label="t('policies.priority', 'Priority')"
          width="90"
          align="center"
        >
          <template #default="{ row }">
            <el-tag type="warning" size="small" effect="plain">
              {{ row.priority }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column
          prop="enabled"
          :label="t('common.status', 'Status')"
          width="100"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="getEnabledType(row.enabled)" size="small">
              {{ getEnabledLabel(row.enabled) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column prop="createdAt" :label="t('common.createdAt', 'Created At')" width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column
          :label="t('common.actions', 'Actions')"
          width="260"
          fixed="right"
          align="center"
        >
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button size="small" type="primary" :icon="Edit" @click="openEditDialog(row)">
                {{ t('common.edit', 'Edit') }}
              </el-button>
              <el-button
                size="small"
                :type="row.enabled ? 'warning' : 'success'"
                @click="handleToggleEnabled(row)"
              >
                {{ row.enabled ? t('common.disable', 'Disable') : t('common.enable', 'Enable') }}
              </el-button>
              <el-popconfirm
                :title="t('policies.deleteConfirm', 'Are you sure to delete this policy?')"
                :confirm-button-text="t('common.confirm', 'Confirm')"
                :cancel-button-text="t('common.cancel', 'Cancel')"
                @confirm="handleDelete(row)"
              >
                <template #reference>
                  <el-button type="danger" size="small" :loading="deleteLoading === row.id">
                    {{ t('common.delete', 'Delete') }}
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty v-else :description="t('policies.noData', 'No policies found')">
        <el-button type="primary" :icon="Plus" @click="openCreateDialog">
          {{ t('policies.createFirst', 'Create First Policy') }}
        </el-button>
      </el-empty>

      <!-- Pagination -->
      <div v-if="total > 0" class="pagination-section">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
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
      width="780px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules()"
        label-width="100px"
        label-position="top"
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('policies.name', 'Policy Name')" prop="name">
              <el-input
                v-model="formData.name"
                :placeholder="t('policies.namePlaceholder', 'e.g., Admin Full Access')"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('policies.effect', 'Effect')" prop="effect">
              <el-select v-model="formData.effect" class="full-width">
                <el-option
                  v-for="option in effectOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="t('policies.description', 'Description')">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="2"
            :placeholder="t('policies.descriptionPlaceholder', 'Describe this policy purpose')"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('policies.subject', 'Subject')" prop="subject">
              <el-input
                v-model="formData.subject"
                :placeholder="t('policies.subjectPlaceholder', 'e.g., role:admin, user:*')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('policies.resource', 'Resource')" prop="resource">
              <el-input
                v-model="formData.resource"
                :placeholder="t('policies.resourcePlaceholder', 'e.g., policy, user, *')"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item :label="t('policies.action', 'Action')" prop="action">
              <el-input
                v-model="formData.action"
                :placeholder="t('policies.actionPlaceholder', 'e.g., read, create, *')"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('policies.priority', 'Priority')">
              <el-input-number
                v-model="formData.priority"
                :min="0"
                :max="1000"
                class="full-width"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item :label="t('common.status', 'Enabled')">
          <el-switch
            v-model="formData.enabled"
            :active-text="t('common.enabled', 'Enabled')"
            :inactive-text="t('common.disabled', 'Disabled')"
          />
        </el-form-item>

        <!-- Conditions Section -->
        <el-divider content-position="left">
          <span class="divider-title">{{ t('policies.conditions', 'Access Conditions') }}</span>
        </el-divider>

        <!-- Time Condition -->
        <div class="condition-section">
          <div class="condition-header">
            <div class="condition-title">
              <el-icon><Clock /></el-icon>
              <span>{{ t('policies.timeCondition', 'Time Condition') }}</span>
            </div>
            <div class="condition-controls">
              <el-switch v-model="timeEnabled" />
              <el-button
                v-if="timeEnabled"
                type="info"
                size="small"
                text
                @click="clearTimeCondition"
              >
                {{ t('common.clear', 'Clear') }}
              </el-button>
            </div>
          </div>

          <el-collapse-transition>
            <div v-show="timeEnabled" class="condition-body">
              <div class="time-row">
                <div class="time-field">
                  <label>{{ t('policies.startTime', 'Start Time') }}</label>
                  <el-time-picker
                    v-model="timeConditionData.start"
                    format="HH:mm"
                    value-format="HH:mm"
                    :placeholder="t('policies.startTimePlaceholder', 'Start')"
                    :disabled="!timeEnabled"
                  />
                </div>
                <div class="time-field">
                  <label>{{ t('policies.endTime', 'End Time') }}</label>
                  <el-time-picker
                    v-model="timeConditionData.end"
                    format="HH:mm"
                    value-format="HH:mm"
                    :placeholder="t('policies.endTimePlaceholder', 'End')"
                    :disabled="!timeEnabled"
                  />
                </div>
              </div>

              <div class="days-section">
                <label>{{ t('policies.allowedDays', 'Allowed Days') }}</label>
                <el-checkbox-group v-model="timeConditionData.daysOfWeek" :disabled="!timeEnabled">
                  <el-checkbox v-for="day in dayOfWeekOptions" :key="day.value" :value="day.value">
                    {{ day.label }}
                  </el-checkbox>
                </el-checkbox-group>
              </div>
            </div>
          </el-collapse-transition>
        </div>

        <!-- IP Condition -->
        <div class="condition-section">
          <div class="condition-header">
            <div class="condition-title">
              <el-icon><Location /></el-icon>
              <span>{{ t('policies.ipCondition', 'IP Condition') }}</span>
            </div>
            <div class="condition-controls">
              <el-switch v-model="ipEnabled" />
              <el-button v-if="ipEnabled" type="info" size="small" text @click="clearIpCondition">
                {{ t('common.clear', 'Clear') }}
              </el-button>
            </div>
          </div>

          <el-collapse-transition>
            <div v-show="ipEnabled" class="condition-body">
              <label>{{ t('policies.allowedIps', 'Allowed IPs / CIDR') }}</label>
              <div class="ip-list">
                <div v-for="(_, index) in ipConditionData.allowed" :key="index" class="ip-item">
                  <el-input
                    v-model="ipConditionData.allowed[index]"
                    :placeholder="t('policies.ipPlaceholder', 'e.g., 192.168.1.1')"
                    :disabled="!ipEnabled"
                    class="ip-input"
                  />
                  <el-button
                    type="danger"
                    :icon="Delete"
                    circle
                    size="small"
                    :disabled="!ipEnabled"
                    @click="removeIpAddress(index)"
                  />
                </div>
              </div>
              <el-button
                type="primary"
                size="small"
                plain
                :disabled="!ipEnabled"
                @click="addIpAddress"
              >
                + {{ t('policies.addIp', 'Add IP') }}
              </el-button>
            </div>
          </el-collapse-transition>
        </div>

        <!-- JSON Preview -->
        <el-divider content-position="left">
          <span class="divider-title">{{ t('policies.conditionsPreview', 'Preview') }}</span>
        </el-divider>

        <div class="json-preview">
          <el-input
            :model-value="conditionsJson"
            type="textarea"
            :rows="6"
            readonly
            class="json-textarea"
          />
        </div>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">
          {{ t('common.cancel', 'Cancel') }}
        </el-button>
        <el-button type="primary" :loading="formLoading" @click="handleSubmit">
          {{ dialogMode === 'create' ? t('common.create', 'Create') : t('common.save', 'Save') }}
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

/* Filter Section */
.filter-section {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fb;
  border-radius: 8px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
  margin-right: 12px;
}

.filter-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #606266;
}

/* Table Styles */
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

.subject-tag {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #fff;
}

.code-tag {
  padding: 2px 8px;
  background: #f0f2f5;
  border-radius: 4px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  color: #1a1a2e;
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

/* Pagination Section */
.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

/* Empty State */
:deep(.el-empty) {
  padding: 48px 0;
}

/* Responsive */
@media (max-width: 1200px) {
  .filter-form {
    flex-direction: column;
  }

  .filter-form :deep(.el-form-item) {
    margin-right: 0;
    width: 100%;
  }

  .filter-form :deep(.el-input),
  .filter-form :deep(.el-select) {
    width: 100% !important;
  }
}

/* Condition Section Styles */
.divider-title {
  font-weight: 600;
  color: #1a1a2e;
}

.condition-section {
  margin-bottom: 20px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.condition-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f7fa;
}

.condition-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: #1a1a2e;
}

.condition-title .el-icon {
  color: #667eea;
}

.condition-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.condition-body {
  padding: 16px;
}

.condition-body label {
  display: block;
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.time-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.time-field {
  flex: 1;
}

.time-field :deep(.el-date-editor) {
  width: 100%;
}

.days-section :deep(.el-checkbox-group) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.days-section :deep(.el-checkbox) {
  margin-right: 0;
}

.ip-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.ip-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.ip-input {
  flex: 1;
}

.json-preview {
  margin-top: 8px;
}

.json-textarea :deep(.el-textarea__inner) {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 12px;
  background: #f5f7fa;
  color: #606266;
}

.no-conditions {
  color: #c0c4cc;
}
</style>
