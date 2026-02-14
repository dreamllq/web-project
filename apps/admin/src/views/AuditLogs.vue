<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="audit-logs-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <h2>{{ t('menu.auditLogs') }}</h2>
          <el-button type="primary">
            <el-icon><Download /></el-icon>
            Export
          </el-button>
        </div>
      </template>
      
      <div class="placeholder-content">
        <el-icon :size="64" color="#c0c4cc"><Document /></el-icon>
        <p>Audit logs will be implemented here</p>
        <p class="hint">Task 19: Audit Logs</p>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.audit-logs-page {
  padding: 0;
}

.page-card {
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
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

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
}

.placeholder-content p {
  margin-top: 16px;
  font-size: 16px;
}

.placeholder-content .hint {
  font-size: 14px;
  color: #c0c4cc;
  margin-top: 8px;
}
</style>
