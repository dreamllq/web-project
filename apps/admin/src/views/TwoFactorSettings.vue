<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Lock, Key, Refresh, WarningFilled, SuccessFilled } from '@element-plus/icons-vue';
import {
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  regenerateRecoveryCodes,
} from '@/api/user';
import { extractApiError } from '@/api';
import type { TwoFactorStatus, TwoFactorSetupResponse } from '@/types/auth';

// Loading states
const loading = ref(false);
const settingUp = ref(false);
const enabling = ref(false);
const disabling = ref(false);
const regenerating = ref(false);

// Data
const status = ref<TwoFactorStatus | null>(null);
const setupData = ref<TwoFactorSetupResponse | null>(null);
const recoveryCodes = ref<string[]>([]);

// Dialog states
const showSetupDialog = ref(false);
const showRecoveryCodesDialog = ref(false);
const verifyCode = ref('');

// Computed
const is2FAEnabled = computed(() => status.value?.enabled ?? false);

// Fetch 2FA status on mount
async function fetchStatus() {
  loading.value = true;
  try {
    const response = await getTwoFactorStatus();
    status.value = response.data.data;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

// Start 2FA setup
async function handleSetup() {
  settingUp.value = true;
  try {
    const response = await setupTwoFactor();
    setupData.value = response.data;
    verifyCode.value = '';
    showSetupDialog.value = true;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    settingUp.value = false;
  }
}

// Enable 2FA after verifying code
async function handleEnable() {
  if (!verifyCode.value || verifyCode.value.length < 6) {
    ElMessage.warning('Please enter a valid 6-digit verification code');
    return;
  }

  enabling.value = true;
  try {
    const response = await enableTwoFactor({ code: verifyCode.value });
    recoveryCodes.value = response.data.recoveryCodes || [];
    showSetupDialog.value = false;
    showRecoveryCodesDialog.value = true;
    await fetchStatus();
    ElMessage.success('Two-factor authentication enabled successfully');
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    enabling.value = false;
  }
}

// Cancel setup
function handleCancelSetup() {
  showSetupDialog.value = false;
  setupData.value = null;
  verifyCode.value = '';
}

// Close recovery codes dialog
function handleCloseRecoveryCodes() {
  showRecoveryCodesDialog.value = false;
  recoveryCodes.value = [];
}

// Confirm disable
function handleConfirmDisable() {
  ElMessageBox.confirm(
    'Are you sure you want to disable two-factor authentication? This will make your account less secure.',
    'Disable 2FA',
    {
      confirmButtonText: 'Yes, Disable',
      cancelButtonText: 'Cancel',
      type: 'warning',
      inputType: 'text',
      inputPlaceholder: 'Type "DISABLE" to confirm',
      inputValidator: (value) => value === 'DISABLE',
      inputErrorMessage: 'Please type "DISABLE" to confirm',
    }
  )
    .then(() => {
      handleDisable();
    })
    .catch(() => {
      // User cancelled
    });
}

// Disable 2FA
async function handleDisable() {
  disabling.value = true;
  try {
    await disableTwoFactor();
    await fetchStatus();
    ElMessage.success('Two-factor authentication disabled');
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    disabling.value = false;
  }
}

// Regenerate recovery codes
async function handleRegenerateCodes() {
  ElMessageBox.confirm(
    'This will invalidate your current recovery codes and generate new ones. Make sure to save the new codes securely.',
    'Regenerate Recovery Codes',
    {
      confirmButtonText: 'Regenerate',
      cancelButtonText: 'Cancel',
      type: 'warning',
    }
  )
    .then(async () => {
      regenerating.value = true;
      try {
        const response = await regenerateRecoveryCodes();
        recoveryCodes.value = response.data.recoveryCodes;
        showRecoveryCodesDialog.value = true;
        ElMessage.success('Recovery codes regenerated successfully');
      } catch (error: unknown) {
        const apiError = extractApiError(error);
        ElMessage.error(apiError.displayMessage);
      } finally {
        regenerating.value = false;
      }
    })
    .catch(() => {
      // User cancelled
    });
}

// Copy recovery codes to clipboard
async function copyRecoveryCodes() {
  const codes = recoveryCodes.value.join('\n');
  try {
    await navigator.clipboard.writeText(codes);
    ElMessage.success('Recovery codes copied to clipboard');
  } catch {
    ElMessage.error('Failed to copy to clipboard');
  }
}

// Print recovery codes
function printRecoveryCodes() {
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Two-Factor Authentication Recovery Codes</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              padding: 40px;
              max-width: 600px;
              margin: 0 auto;
            }
            h1 { color: #1a1a2e; margin-bottom: 20px; }
            .warning {
              background: #fff3cd;
              border: 1px solid #ffc107;
              padding: 16px;
              border-radius: 8px;
              margin-bottom: 24px;
            }
            .codes {
              background: #f5f7fa;
              padding: 24px;
              border-radius: 8px;
              border: 1px solid #e4e7ed;
            }
            .code {
              font-size: 18px;
              padding: 8px 0;
              border-bottom: 1px dashed #dcdfe6;
            }
            .code:last-child { border-bottom: none; }
          </style>
        </head>
        <body>
          <h1>Two-Factor Authentication Recovery Codes</h1>
          <div class="warning">
            <strong>Important:</strong> Store these codes securely. Each code can only be used once to access your account if you lose your authenticator device.
          </div>
          <div class="codes">
            ${recoveryCodes.value.map((code) => `<div class="code">${code}</div>`).join('')}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }
}

onMounted(() => {
  fetchStatus();
});
</script>

<template>
  <div class="twofactor-page">
    <h1 class="page-title">Two-Factor Authentication</h1>

    <el-card v-loading="loading" class="twofactor-card">
      <!-- Status Section -->
      <div class="status-section">
        <div class="status-header">
          <div class="status-icon" :class="{ enabled: is2FAEnabled }">
            <el-icon :size="32">
              <Lock v-if="is2FAEnabled" />
              <Key v-else />
            </el-icon>
          </div>
          <div class="status-info">
            <h2>{{ is2FAEnabled ? '2FA is Enabled' : '2FA is Disabled' }}</h2>
            <p v-if="is2FAEnabled && status?.verifiedAt">
              Enabled on: {{ new Date(status.verifiedAt).toLocaleDateString() }}
            </p>
            <p v-else>
              Add an extra layer of security to your account by enabling two-factor authentication.
            </p>
          </div>
          <el-tag :type="is2FAEnabled ? 'success' : 'info'" size="large" class="status-tag">
            <el-icon style="margin-right: 4px">
              <SuccessFilled v-if="is2FAEnabled" />
              <WarningFilled v-else />
            </el-icon>
            {{ is2FAEnabled ? 'Protected' : 'Not Protected' }}
          </el-tag>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="actions-section">
        <template v-if="!is2FAEnabled">
          <el-alert type="info" :closable="false" show-icon class="security-alert">
            <template #title>
              <strong>Enhance your account security</strong>
            </template>
            Two-factor authentication adds an extra layer of protection by requiring a code from
            your authenticator app when you sign in.
          </el-alert>
          <el-button
            type="primary"
            :loading="settingUp"
            class="action-btn enable-btn"
            @click="handleSetup"
          >
            <el-icon style="margin-right: 8px"><Key /></el-icon>
            Enable 2FA
          </el-button>
        </template>

        <template v-else>
          <el-alert type="success" :closable="false" show-icon class="security-alert">
            <template #title>
              <strong>Your account is protected</strong>
            </template>
            Two-factor authentication is active. You'll need a code from your authenticator app to
            sign in.
          </el-alert>

          <div class="enabled-actions">
            <el-button
              :loading="regenerating"
              class="action-btn regenerate-btn"
              @click="handleRegenerateCodes"
            >
              <el-icon style="margin-right: 8px"><Refresh /></el-icon>
              Regenerate Recovery Codes
            </el-button>
            <el-button
              type="danger"
              :loading="disabling"
              class="action-btn disable-btn"
              @click="handleConfirmDisable"
            >
              <el-icon style="margin-right: 8px"><Lock /></el-icon>
              Disable 2FA
            </el-button>
          </div>
        </template>
      </div>
    </el-card>

    <!-- Setup Dialog -->
    <el-dialog
      v-model="showSetupDialog"
      title="Set Up Two-Factor Authentication"
      width="500px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div v-if="setupData" class="setup-content">
        <el-alert type="warning" :closable="false" show-icon class="setup-alert">
          Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
        </el-alert>

        <div class="qr-container">
          <img :src="setupData.qrCodeUrl" alt="2FA QR Code" class="qr-code" />
        </div>

        <div class="secret-section">
          <p class="secret-label">Or enter this code manually:</p>
          <div class="secret-code">
            <code>{{ setupData.secret }}</code>
          </div>
        </div>

        <el-divider />

        <div class="verify-section">
          <p class="verify-label">Enter the 6-digit code from your authenticator app:</p>
          <el-input
            v-model="verifyCode"
            placeholder="000000"
            maxlength="6"
            class="verify-input"
            @keyup.enter="handleEnable"
          />
        </div>
      </div>

      <template #footer>
        <el-button @click="handleCancelSetup">Cancel</el-button>
        <el-button
          type="primary"
          :loading="enabling"
          :disabled="!verifyCode || verifyCode.length < 6"
          @click="handleEnable"
        >
          Verify & Enable
        </el-button>
      </template>
    </el-dialog>

    <!-- Recovery Codes Dialog -->
    <el-dialog
      v-model="showRecoveryCodesDialog"
      title="Recovery Codes"
      width="500px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="recovery-content">
        <el-alert type="warning" :closable="false" show-icon class="recovery-alert">
          <strong>Important:</strong> Save these recovery codes in a secure location. Each code can
          only be used once to access your account if you lose your authenticator device.
        </el-alert>

        <div class="codes-container">
          <div v-for="(code, index) in recoveryCodes" :key="index" class="recovery-code">
            <span class="code-number">{{ index + 1 }}.</span>
            <code class="code-value">{{ code }}</code>
          </div>
        </div>

        <div class="codes-actions">
          <el-button @click="copyRecoveryCodes"> Copy All Codes </el-button>
          <el-button @click="printRecoveryCodes"> Print Codes </el-button>
        </div>
      </div>

      <template #footer>
        <el-button type="primary" @click="handleCloseRecoveryCodes">
          I've Saved My Codes
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.twofactor-page {
  padding: 0;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 24px;
}

.twofactor-card {
  max-width: 700px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.twofactor-card :deep(.el-card__body) {
  padding: 32px;
}

.status-section {
  margin-bottom: 32px;
}

.status-header {
  display: flex;
  align-items: flex-start;
  gap: 20px;
}

.status-icon {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e8e8e8 0%, #d4d4d4 100%);
  color: #666;
  flex-shrink: 0;
}

.status-icon.enabled {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.status-info {
  flex: 1;
}

.status-info h2 {
  font-size: 20px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 8px 0;
}

.status-info p {
  font-size: 14px;
  color: #606266;
  margin: 0;
}

.status-tag {
  flex-shrink: 0;
  padding: 8px 16px;
  font-weight: 500;
}

.actions-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.security-alert {
  border-radius: 8px;
}

.security-alert :deep(.el-alert__title) {
  font-size: 14px;
}

.enabled-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  height: 44px;
  padding: 0 24px;
  font-weight: 500;
  border-radius: 8px;
  font-size: 14px;
}

.enable-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.enable-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.regenerate-btn {
  border: 1px solid #dcdfe6;
  background: #fff;
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    border-color 0.2s;
}

.regenerate-btn:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.disable-btn {
  background: #fff;
  border: 1px solid #f56c6c;
  color: #f56c6c;
  transition:
    transform 0.2s,
    box-shadow 0.2s,
    background 0.2s;
}

.disable-btn:hover {
  background: #fef0f0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 108, 108, 0.2);
}

/* Setup Dialog Styles */
.setup-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setup-alert {
  border-radius: 8px;
}

.qr-container {
  display: flex;
  justify-content: center;
  padding: 20px;
  background: #fafafa;
  border-radius: 12px;
}

.qr-code {
  width: 200px;
  height: 200px;
  border-radius: 8px;
}

.secret-section {
  text-align: center;
}

.secret-label {
  font-size: 13px;
  color: #909399;
  margin: 0 0 8px 0;
}

.secret-code {
  display: inline-block;
  padding: 12px 20px;
  background: #f5f7fa;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.secret-code code {
  font-family: 'Courier New', monospace;
  font-size: 16px;
  color: #303133;
  letter-spacing: 2px;
}

.verify-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.verify-label {
  font-size: 14px;
  color: #606266;
  margin: 0;
}

.verify-input :deep(.el-input__wrapper) {
  border-radius: 8px;
}

.verify-input :deep(.el-input__inner) {
  font-size: 24px;
  text-align: center;
  letter-spacing: 8px;
  font-family: 'Courier New', monospace;
}

/* Recovery Codes Dialog Styles */
.recovery-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.recovery-alert {
  border-radius: 8px;
}

.codes-container {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
  background: #fafafa;
  border-radius: 12px;
  border: 1px solid #ebeef5;
}

.recovery-code {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}

.code-number {
  font-size: 12px;
  color: #909399;
  min-width: 20px;
}

.code-value {
  font-family: 'Courier New', monospace;
  font-size: 14px;
  color: #303133;
  letter-spacing: 1px;
}

.codes-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.codes-actions .el-button {
  border-radius: 8px;
}

/* Dialog Overrides */
:deep(.el-dialog) {
  border-radius: 12px;
}

:deep(.el-dialog__header) {
  padding: 20px 24px;
  border-bottom: 1px solid #ebeef5;
}

:deep(.el-dialog__title) {
  font-weight: 600;
  color: #1a1a2e;
}

:deep(.el-dialog__body) {
  padding: 24px;
}

:deep(.el-dialog__footer) {
  padding: 16px 24px;
  border-top: 1px solid #ebeef5;
}

/* Responsive */
@media (max-width: 600px) {
  .status-header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }

  .status-tag {
    align-self: center;
  }

  .enabled-actions {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }

  .codes-container {
    grid-template-columns: 1fr;
  }
}
</style>
