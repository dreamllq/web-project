<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Search, Check, Close, Timer, User, Document, Operation } from '@element-plus/icons-vue';
import { testPermission, type TestPermissionResult, type TestPermissionDto } from '@/api/abac';
import { getAdminUsers } from '@/api/admin-user';
import { extractApiError } from '@/api';
import type { AdminUserResponse } from '@/types/user';

// ============================================
// State
// ============================================
const loading = ref(false);
const users = ref<AdminUserResponse[]>([]);
const usersLoading = ref(false);

const formRef = ref();
const form = reactive<TestPermissionDto>({
  userId: '',
  resource: '',
  action: '',
});

const result = ref<TestPermissionResult | null>(null);

// Common resources and actions for quick selection
const commonResources = [
  'user',
  'role',
  'policy',
  'permission',
  'audit-log',
  'system',
  'dashboard',
];

const commonActions = ['create', 'read', 'update', 'delete', 'list', 'manage'];

// ============================================
// Functions
// ============================================
async function fetchUsers() {
  usersLoading.value = true;
  try {
    const response = await getAdminUsers({ limit: 100, offset: 0 });
    users.value = response.data.data;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    usersLoading.value = false;
  }
}

async function handleSubmit() {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();
  } catch {
    return;
  }

  loading.value = true;
  result.value = null;

  try {
    const response = await testPermission({
      userId: form.userId,
      resource: form.resource,
      action: form.action,
    });
    result.value = response.data;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

function handleReset() {
  form.userId = '';
  form.resource = '';
  form.action = '';
  result.value = null;
}

function formRules() {
  return {
    userId: [{ required: true, message: 'Please select a user', trigger: 'change' }],
    resource: [{ required: true, message: 'Please enter a resource', trigger: 'blur' }],
    action: [{ required: true, message: 'Please enter an action', trigger: 'blur' }],
  };
}

// ============================================
// Lifecycle
// ============================================
onMounted(() => {
  fetchUsers();
});
</script>

<template>
  <div class="policy-test-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <h2>Policy Test Tool</h2>
            <p class="subtitle">Test user permissions against ABAC policies</p>
          </div>
        </div>
      </template>

      <div class="content-grid">
        <!-- Form Section -->
        <div class="form-section">
          <el-form
            ref="formRef"
            :model="form"
            :rules="formRules()"
            label-position="top"
            class="test-form"
          >
            <el-form-item label="User" prop="userId">
              <el-select
                v-model="form.userId"
                filterable
                placeholder="Select a user"
                :loading="usersLoading"
                class="full-width"
              >
                <el-option
                  v-for="user in users"
                  :key="user.id"
                  :label="user.username"
                  :value="user.id"
                >
                  <div class="user-option">
                    <el-icon class="user-icon"><User /></el-icon>
                    <span class="username">{{ user.username }}</span>
                    <span v-if="user.email" class="email">{{ user.email }}</span>
                  </div>
                </el-option>
              </el-select>
            </el-form-item>

            <el-form-item label="Resource" prop="resource">
              <el-select
                v-model="form.resource"
                filterable
                allow-create
                default-first-option
                placeholder="Select or enter resource"
                class="full-width"
              >
                <el-option
                  v-for="resource in commonResources"
                  :key="resource"
                  :label="resource"
                  :value="resource"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="Action" prop="action">
              <el-select
                v-model="form.action"
                filterable
                allow-create
                default-first-option
                placeholder="Select or enter action"
                class="full-width"
              >
                <el-option
                  v-for="action in commonActions"
                  :key="action"
                  :label="action"
                  :value="action"
                />
              </el-select>
            </el-form-item>

            <div class="form-actions">
              <el-button type="primary" :icon="Search" :loading="loading" @click="handleSubmit">
                Test Permission
              </el-button>
              <el-button @click="handleReset">Reset</el-button>
            </div>
          </el-form>
        </div>

        <!-- Result Section -->
        <div class="result-section">
          <div v-if="!result" class="empty-result">
            <div class="empty-icon">
              <el-icon :size="48"><Operation /></el-icon>
            </div>
            <p>Select a user, resource, and action to test permissions</p>
          </div>

          <div v-else class="result-content">
            <!-- Status Badge -->
            <div class="status-section" :class="result.allowed ? 'allowed' : 'denied'">
              <div class="status-badge">
                <el-icon :size="32">
                  <Check v-if="result.allowed" />
                  <Close v-else />
                </el-icon>
                <span class="status-text">{{ result.allowed ? 'ALLOWED' : 'DENIED' }}</span>
              </div>
            </div>

            <!-- User Info -->
            <div class="info-card">
              <div class="info-title">
                <el-icon><User /></el-icon>
                <span>User Information</span>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">ID</span>
                  <span class="value">{{ result.user.id }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Username</span>
                  <span class="value">{{ result.user.username }}</span>
                </div>
                <div class="info-item full-width">
                  <span class="label">Roles</span>
                  <div class="roles-list">
                    <el-tag
                      v-for="role in result.user.roles"
                      :key="role"
                      size="small"
                      class="role-tag"
                    >
                      {{ role }}
                    </el-tag>
                    <span v-if="!result.user.roles.length" class="no-roles">No roles assigned</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Request Info -->
            <div class="info-card">
              <div class="info-title">
                <el-icon><Document /></el-icon>
                <span>Request Details</span>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">Resource</span>
                  <span class="value resource-value">{{ result.resource }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Action</span>
                  <span class="value action-value">{{ result.action }}</span>
                </div>
              </div>
            </div>

            <!-- Matched Policies -->
            <div class="info-card">
              <div class="info-title">
                <span>Matched Policies</span>
                <el-tag size="small" type="info">{{ result.matchedPolicies.length }} found</el-tag>
              </div>
              <div v-if="result.matchedPolicies.length === 0" class="no-policies">
                No policies matched this request
              </div>
              <el-table
                v-else
                :data="result.matchedPolicies"
                stripe
                size="small"
                class="policies-table"
              >
                <el-table-column prop="name" label="Name" min-width="120" />
                <el-table-column prop="effect" label="Effect" width="90" align="center">
                  <template #default="{ row }">
                    <el-tag :type="row.effect === 'allow' ? 'success' : 'danger'" size="small">
                      {{ row.effect }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column prop="subject" label="Subject" min-width="100" />
                <el-table-column prop="priority" label="Priority" width="80" align="center" />
              </el-table>
            </div>

            <!-- Evaluation Time -->
            <div class="evaluation-time">
              <el-icon><Timer /></el-icon>
              <span>Evaluation time: {{ result.evaluationTimeMs }}ms</span>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.policy-test-page {
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
  align-items: flex-start;
}

.header-left h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 4px 0;
}

.subtitle {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
  margin-top: 8px;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}

.form-section {
  background: #f8fafc;
  border-radius: 12px;
  padding: 24px;
}

.test-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.full-width {
  width: 100%;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.form-actions .el-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.form-actions .el-button--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.user-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-icon {
  color: #667eea;
}

.username {
  font-weight: 500;
}

.email {
  color: #9ca3af;
  font-size: 12px;
  margin-left: auto;
}

.result-section {
  min-height: 400px;
}

.empty-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
  color: #9ca3af;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.empty-icon .el-icon {
  color: #667eea;
}

.empty-result p {
  max-width: 240px;
  line-height: 1.5;
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-section {
  padding: 24px;
  border-radius: 12px;
  text-align: center;
  transition: all 0.3s ease;
}

.status-section.allowed {
  background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
  border: 1px solid #a7f3d0;
}

.status-section.denied {
  background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
  border: 1px solid #fca5a5;
}

.status-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.status-section.allowed .el-icon {
  color: #059669;
}

.status-section.denied .el-icon {
  color: #dc2626;
}

.status-text {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 2px;
}

.status-section.allowed .status-text {
  color: #059669;
}

.status-section.denied .status-text {
  color: #dc2626;
}

.info-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

.info-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}

.info-title .el-icon {
  color: #667eea;
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.info-item .label {
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-item .value {
  font-weight: 500;
  color: #1f2937;
  font-family: 'SF Mono', Monaco, 'Andale Mono', monospace;
  font-size: 13px;
}

.resource-value {
  color: #667eea !important;
}

.action-value {
  color: #764ba2 !important;
}

.roles-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.role-tag {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #fff;
}

.no-roles {
  font-size: 13px;
  color: #9ca3af;
  font-style: italic;
}

.no-policies {
  text-align: center;
  color: #9ca3af;
  padding: 16px;
  font-size: 14px;
}

.policies-table {
  margin-top: 8px;
}

.policies-table :deep(.el-table__header th) {
  background-color: #f9fafb;
  font-weight: 600;
  color: #374151;
}

.evaluation-time {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: #f3f4f6;
  border-radius: 8px;
  color: #6b7280;
  font-size: 13px;
}

.evaluation-time .el-icon {
  color: #9ca3af;
}
</style>
