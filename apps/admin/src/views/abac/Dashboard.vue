<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';

import { extractApiError } from '@/api';
import { getCoverage } from '@/api/abac';
import type { CoverageResponse } from '@/types/abac';

const { t } = useI18n();

const loading = ref(true);
const coverageData = ref<CoverageResponse | null>(null);

const coveragePercent = computed(() => coverageData.value?.coverage_percent ?? 0);
const progressColor = computed(() => {
  const percent = coveragePercent.value;
  if (percent >= 80) return '#10b981';
  if (percent >= 50) return '#f59e0b';
  return '#ef4444';
});

const hasMissingPolicies = computed(() => {
  return coverageData.value?.missing_policies && coverageData.value.missing_policies.length > 0;
});

async function fetchCoverage() {
  loading.value = true;
  try {
    const response = await getCoverage();
    coverageData.value = response.data;
  } catch (error) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchCoverage();
});
</script>

<template>
  <div class="abac-dashboard">
    <h1 class="page-title">{{ t('abac.dashboard.title') }}</h1>

    <!-- Loading State -->
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading" :size="48"><Loading /></el-icon>
    </div>

    <template v-else-if="coverageData">
      <!-- Coverage Overview Cards -->
      <el-row :gutter="24" class="stats-row">
        <el-col :span="6">
          <el-card class="stat-card coverage-card">
            <div class="stat-content">
              <div class="stat-value" :style="{ color: progressColor }">{{ coveragePercent }}%</div>
              <div class="stat-label">{{ t('abac.dashboard.coveragePercent') }}</div>
            </div>
            <el-progress
              :percentage="coveragePercent"
              :color="progressColor"
              :stroke-width="8"
              :show-text="false"
              class="coverage-progress"
            />
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stat-card rbac-card">
            <div class="stat-icon">
              <el-icon :size="32"><Key /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ coverageData.rbac_count }}</div>
              <div class="stat-label">{{ t('abac.dashboard.rbacCount') }}</div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stat-card abac-card">
            <div class="stat-icon">
              <el-icon :size="32"><Shield /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ coverageData.abac_count }}</div>
              <div class="stat-label">{{ t('abac.dashboard.abacCount') }}</div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stat-card enabled-card">
            <div class="stat-icon">
              <el-icon :size="32"><CircleCheck /></el-icon>
            </div>
            <div class="stat-content">
              <div class="stat-value">{{ coverageData.enabled_abac_count }}</div>
              <div class="stat-label">{{ t('abac.dashboard.enabledCount') }}</div>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="24" class="content-row">
        <!-- Role Coverage Table -->
        <el-col :span="hasMissingPolicies ? 12 : 24">
          <el-card class="table-card">
            <template #header>
              <div class="card-header">
                <span>
                  <el-icon><DataLine /></el-icon>
                  {{ t('abac.dashboard.roleCoverage') }}
                </span>
              </div>
            </template>
            <el-table
              :data="coverageData.role_coverage"
              stripe
              style="width: 100%"
              :empty-text="t('common.noData')"
            >
              <el-table-column prop="role" :label="t('abac.dashboard.role')" min-width="150">
                <template #default="{ row }">
                  <el-tag type="info">{{ row.role }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column
                prop="policies"
                :label="t('abac.dashboard.policies')"
                align="center"
                width="120"
              />
              <el-table-column
                prop="permissions"
                :label="t('abac.dashboard.permissions')"
                align="center"
                width="120"
              />
            </el-table>
          </el-card>
        </el-col>

        <!-- Missing Policies Card -->
        <el-col v-if="hasMissingPolicies" :span="12">
          <el-card class="missing-card">
            <template #header>
              <div class="card-header warning">
                <span>
                  <el-icon><Warning /></el-icon>
                  {{ t('abac.dashboard.missingPolicies') }}
                </span>
                <el-tag type="warning" size="small">
                  {{ coverageData.missing_policies.length }}
                </el-tag>
              </div>
            </template>
            <el-table
              :data="coverageData.missing_policies"
              max-height="300"
              stripe
              style="width: 100%"
            >
              <el-table-column
                prop="permission_name"
                :label="t('abac.dashboard.permissionName')"
                min-width="180"
              />
              <el-table-column
                prop="resource"
                :label="t('abac.dashboard.resource')"
                min-width="120"
              />
              <el-table-column prop="action" :label="t('abac.dashboard.action')" width="100" />
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- Full Coverage Message -->
      <el-card v-if="!hasMissingPolicies" class="success-card">
        <div class="success-content">
          <el-icon :size="48" color="#10b981"><CircleCheckFilled /></el-icon>
          <h3>{{ t('abac.dashboard.fullCoverage') }}</h3>
          <p>{{ t('abac.dashboard.fullCoverageDesc') }}</p>
        </div>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.abac-dashboard {
  padding: 0;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 24px;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: #667eea;
}

.stats-row {
  margin-bottom: 24px;
}

.stat-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  padding: 20px;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}

.stat-card .stat-content {
  flex: 1;
}

.stat-card .stat-value {
  font-size: 32px;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.2;
}

.stat-card .stat-label {
  font-size: 14px;
  color: #909399;
  margin-top: 4px;
}

/* Coverage Card */
.coverage-card {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
}

.coverage-card .stat-value {
  font-size: 48px;
  margin-bottom: 12px;
}

.coverage-progress {
  margin-top: 16px;
}

/* Icon Cards */
.stat-card.rbac-card,
.stat-card.abac-card,
.stat-card.enabled-card {
  display: flex;
  align-items: center;
}

.stat-icon {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  color: #fff;
}

.rbac-card .stat-icon {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.abac-card .stat-icon {
  background: linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%);
}

.enabled-card .stat-icon {
  background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
}

/* Content Row */
.content-row {
  margin-bottom: 24px;
}

.table-card,
.missing-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #1a1a2e;
}

.card-header span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-header.warning {
  color: #f59e0b;
}

/* Success Card */
.success-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
}

.success-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.success-content h3 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 16px 0 8px;
}

.success-content p {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
}
</style>
