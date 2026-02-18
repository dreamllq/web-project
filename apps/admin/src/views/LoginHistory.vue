<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { getLoginHistory } from '@/api/user';
import { extractApiError } from '@/api';
import type { LoginHistoryItem, LoginHistoryQuery } from '@/types/user';

const { t } = useI18n();

const loading = ref(false);
const loginHistory = ref<LoginHistoryItem[]>([]);
const total = ref(0);

const query = reactive<LoginHistoryQuery>({
  limit: 10,
  offset: 0,
  success: undefined,
  startDate: undefined,
  endDate: undefined,
});

const successFilterOptions = computed(() => [
  { value: undefined, label: t('loginHistory.all') },
  { value: true, label: t('loginHistory.success') },
  { value: false, label: t('loginHistory.failed') },
]);

const currentPage = computed({
  get: () => (query.offset ? Math.floor(query.offset / (query.limit || 10)) + 1 : 1),
  set: (val: number) => {
    query.offset = (val - 1) * (query.limit || 10);
  },
});

const dateRange = ref<[Date, Date] | null>(null);

async function fetchLoginHistory() {
  loading.value = true;
  try {
    const response = await getLoginHistory(query);
    loginHistory.value = response.data.data;
    total.value = response.data.pagination.total;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

function handlePageChange(page: number) {
  query.offset = (page - 1) * (query.limit || 10);
  fetchLoginHistory();
}

function handleSizeChange(size: number) {
  query.limit = size;
  query.offset = 0;
  fetchLoginHistory();
}

function handleDateRangeChange(value: [Date, Date] | null) {
  if (value && value.length === 2) {
    query.startDate = value[0].toISOString();
    query.endDate = value[1].toISOString();
  } else {
    query.startDate = undefined;
    query.endDate = undefined;
  }
  query.offset = 0;
  fetchLoginHistory();
}

function handleSuccessFilterChange() {
  query.offset = 0;
  fetchLoginHistory();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString();
}

onMounted(() => {
  fetchLoginHistory();
});
</script>

<template>
  <div class="login-history-page">
    <h1 class="page-title">{{ t('loginHistory.title') }}</h1>

    <el-card v-loading="loading" class="history-card">
      <!-- Filters Section -->
      <div class="filters-section">
        <div class="filter-item">
          <label class="filter-label">{{ t('loginHistory.filterBySuccess') }}</label>
          <el-select
            v-model="query.success"
            :placeholder="t('loginHistory.filterBySuccess')"
            class="filter-select"
            clearable
            @change="handleSuccessFilterChange"
          >
            <el-option
              v-for="option in successFilterOptions"
              :key="String(option.value)"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>

        <div class="filter-item">
          <label class="filter-label">{{ t('loginHistory.startDate') }}</label>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            :range-separator="'-'"
            :start-placeholder="t('loginHistory.startDate')"
            :end-placeholder="t('loginHistory.endDate')"
            class="date-picker"
            @change="handleDateRangeChange"
          />
        </div>
      </div>

      <!-- Table Section -->
      <el-table :data="loginHistory" class="history-table" stripe>
        <el-table-column prop="ipAddress" :label="t('loginHistory.ipAddress')" min-width="140" />
        <el-table-column
          prop="userAgent"
          :label="t('loginHistory.userAgent')"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column
          prop="deviceFingerprint"
          :label="t('loginHistory.deviceFingerprint')"
          min-width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="loginMethod"
          :label="t('loginHistory.loginMethod')"
          min-width="120"
        />
        <el-table-column :label="t('loginHistory.success')" min-width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">
              {{ row.success ? t('loginHistory.success') : t('loginHistory.failed') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="failureReason"
          :label="t('loginHistory.failureReason')"
          min-width="150"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            {{ row.failureReason || '-' }}
          </template>
        </el-table-column>
        <el-table-column :label="t('loginHistory.createdAt')" min-width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
      </el-table>

      <!-- Empty State -->
      <el-empty
        v-if="!loading && loginHistory.length === 0"
        :description="t('loginHistory.empty')"
        class="empty-state"
      />

      <!-- Pagination -->
      <div v-if="total > 0" class="pagination-section">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="query.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.login-history-page {
  padding: 0;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 24px;
}

.history-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.history-card :deep(.el-card__body) {
  padding: 24px;
}

.filters-section {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #ebeef5;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: #1a1a2e;
}

.filter-select {
  width: 160px;
}

.date-picker {
  width: 280px;
}

.history-table {
  width: 100%;
}

.history-table :deep(.el-table__header th) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #1a1a2e;
}

.history-table :deep(.el-table__row) {
  transition: background-color 0.2s;
}

.history-table :deep(.el-table__row:hover > td) {
  background-color: #f5f7fa !important;
}

.empty-state {
  padding: 40px 0;
}

.pagination-section {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
  padding-top: 16px;
}

:deep(.el-select .el-input__wrapper),
:deep(.el-date-editor .el-input__wrapper) {
  border-radius: 8px;
}

:deep(.el-pagination) {
  --el-pagination-button-bg-color: #f5f7fa;
  --el-pagination-hover-color: #667eea;
}

:deep(.el-pagination.is-background .el-pager li:not(.is-disabled).is-active) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
</style>
