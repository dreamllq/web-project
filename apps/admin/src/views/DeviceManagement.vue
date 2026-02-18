<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { Monitor, Delete, Check } from '@element-plus/icons-vue';
import { getDevices, trustDevice, removeDevice } from '@/api/user';
import { extractApiError } from '@/api';
import type { UserDevice } from '@/types/user';

const { t } = useI18n();

const loading = ref(false);
const devices = ref<UserDevice[]>([]);

async function fetchDevices() {
  loading.value = true;
  try {
    const response = await getDevices();
    devices.value = response.data.data;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

async function handleTrust(device: UserDevice) {
  try {
    await trustDevice(device.id);
    // Update local state
    device.trusted = true;
    ElMessage.success(t('devices.trustSuccess'));
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

async function handleRemove(deviceId: string) {
  try {
    await removeDevice(deviceId);
    // Remove from local state
    devices.value = devices.value.filter((d) => d.id !== deviceId);
    ElMessage.success(t('devices.removeSuccess'));
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  }
}

function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString();
}

onMounted(() => {
  fetchDevices();
});
</script>

<template>
  <div class="device-page">
    <h1 class="page-title">{{ t('devices.title') }}</h1>

    <el-card v-loading="loading" class="device-card">
      <el-table v-if="devices.length > 0" :data="devices" stripe style="width: 100%">
        <el-table-column :label="t('devices.deviceName')" min-width="150">
          <template #default="{ row }">
            <div class="device-name">
              <el-icon class="device-icon"><Monitor /></el-icon>
              <span>{{ row.deviceName || '-' }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="ipAddress" :label="t('devices.ipAddress')" min-width="120" />

        <el-table-column :label="t('devices.trusted')" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="row.trusted ? 'success' : 'info'" size="small">
              {{ row.trusted ? t('devices.trusted') : t('devices.notTrusted') }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column :label="t('devices.lastUsedAt')" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.lastUsedAt) }}
          </template>
        </el-table-column>

        <el-table-column :label="t('devices.createdAt')" min-width="160">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>

        <el-table-column :label="$t('common.edit')" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button
                v-if="!row.trusted"
                type="primary"
                size="small"
                :icon="Check"
                @click="handleTrust(row)"
              >
                {{ t('devices.trust') }}
              </el-button>
              <el-popconfirm
                :title="t('devices.removeConfirm')"
                :confirm-button-text="t('common.confirm')"
                :cancel-button-text="t('common.cancel')"
                @confirm="handleRemove(row.id)"
              >
                <template #reference>
                  <el-button type="danger" size="small" :icon="Delete">
                    {{ t('devices.remove') }}
                  </el-button>
                </template>
              </el-popconfirm>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-else :description="t('devices.empty')" />
    </el-card>
  </div>
</template>

<style scoped>
.device-page {
  padding: 0;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 24px;
}

.device-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.device-card :deep(.el-card__body) {
  padding: 24px;
}

.device-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.device-icon {
  color: #909399;
  font-size: 16px;
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

:deep(.el-table) {
  border-radius: 8px;
  overflow: hidden;
}

:deep(.el-table th.el-table__cell) {
  background-color: #f5f7fa;
  font-weight: 600;
  color: #1a1a2e;
}

:deep(.el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell) {
  background: #fafafa;
}

:deep(.el-tag--success) {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  border: none;
  color: #fff;
}

:deep(.el-tag--info) {
  background: #f0f0f0;
  border: none;
  color: #666;
}

:deep(.el-empty) {
  padding: 48px 0;
}
</style>
