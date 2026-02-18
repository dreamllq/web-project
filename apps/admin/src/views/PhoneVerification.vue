<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Phone, CircleCheck, CircleClose } from '@element-plus/icons-vue';
import { getCurrentUser, sendPhoneVerification, verifyPhone } from '@/api/user';
import { extractApiError } from '@/api';
import type { UserProfileResponse } from '@/types/user';

const loading = ref(false);
const sendingCode = ref(false);
const verifying = ref(false);
const userProfile = ref<UserProfileResponse | null>(null);
const countdown = ref(0);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

const form = reactive({
  phone: '',
  code: '',
});

const isPhoneVerified = computed(() => {
  return !!userProfile.value?.phoneVerifiedAt;
});

const canSendCode = computed(() => {
  return form.phone.length > 0 && countdown.value === 0 && !sendingCode.value;
});

const canVerify = computed(() => {
  return form.code.length >= 4 && !verifying.value;
});

async function fetchUserProfile() {
  loading.value = true;
  try {
    const response = await getCurrentUser();
    userProfile.value = response.data;
    form.phone = response.data.phone || '';
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

function startCountdown() {
  countdown.value = 60;
  countdownTimer = setInterval(() => {
    countdown.value--;
    if (countdown.value <= 0) {
      stopCountdown();
    }
  }, 1000);
}

function stopCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
  countdown.value = 0;
}

async function handleSendCode() {
  if (!form.phone) {
    ElMessage.error('Please enter a phone number');
    return;
  }

  sendingCode.value = true;
  try {
    const response = await sendPhoneVerification(form.phone);
    if (response.data.success) {
      ElMessage.success(response.data.message || 'Verification code sent');
      startCountdown();
    }
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    sendingCode.value = false;
  }
}

async function handleVerify() {
  if (!form.code) {
    ElMessage.error('Please enter verification code');
    return;
  }

  verifying.value = true;
  try {
    const response = await verifyPhone({ code: form.code });
    if (response.data.success) {
      ElMessage.success('Phone verified successfully');
      // Refresh user profile to get updated verification status
      await fetchUserProfile();
      form.code = '';
    }
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    verifying.value = false;
  }
}

onMounted(() => {
  fetchUserProfile();
});

onUnmounted(() => {
  stopCountdown();
});
</script>

<template>
  <div class="phone-verification-page">
    <h1 class="page-title">Phone Verification</h1>

    <el-card v-loading="loading" class="verification-card">
      <!-- Current Phone Status Section -->
      <div class="status-section">
        <div class="status-header">
          <el-icon :size="20"><Phone /></el-icon>
          <span class="status-label">Current Phone</span>
        </div>
        <div class="status-content">
          <span class="phone-number">{{ userProfile?.phone || 'Not set' }}</span>
          <el-tag :type="isPhoneVerified ? 'success' : 'warning'" size="small" class="status-tag">
            <el-icon v-if="isPhoneVerified"><CircleCheck /></el-icon>
            <el-icon v-else><CircleClose /></el-icon>
            <span>{{ isPhoneVerified ? 'Verified' : 'Not Verified' }}</span>
          </el-tag>
        </div>
      </div>

      <el-divider />

      <!-- Phone Input Form -->
      <el-form :model="form" label-position="top" class="verification-form">
        <el-form-item label="Phone Number">
          <el-input
            v-model="form.phone"
            placeholder="Enter phone number"
            :prefix-icon="Phone"
            clearable
            :disabled="sendingCode"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="sendingCode"
            :disabled="!canSendCode"
            class="send-code-btn"
            @click="handleSendCode"
          >
            {{ countdown > 0 ? `Resend in ${countdown}s` : 'Send Verification Code' }}
          </el-button>
        </el-form-item>

        <el-form-item label="Verification Code">
          <el-input
            v-model="form.code"
            placeholder="Enter 6-digit code"
            maxlength="6"
            clearable
            :disabled="verifying"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="success"
            :loading="verifying"
            :disabled="!canVerify"
            class="verify-btn"
            @click="handleVerify"
          >
            Verify Phone
          </el-button>
        </el-form-item>
      </el-form>

      <!-- Info Section -->
      <div class="info-section">
        <p class="info-text">
          <el-icon><CircleCheck /></el-icon>
          A verification code will be sent to your phone via SMS
        </p>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.phone-verification-page {
  padding: 0;
}

.page-title {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 24px;
}

.verification-card {
  max-width: 500px;
  border-radius: 12px;
  border: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
}

.verification-card :deep(.el-card__body) {
  padding: 32px;
}

.status-section {
  margin-bottom: 8px;
}

.status-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #606266;
}

.status-header .el-icon {
  color: #667eea;
}

.status-label {
  font-weight: 500;
  font-size: 14px;
}

.status-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #f0f2f5 100%);
  border-radius: 8px;
}

.phone-number {
  font-size: 16px;
  font-weight: 500;
  color: #1a1a2e;
}

.status-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-tag .el-icon {
  font-size: 14px;
}

.verification-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.el-form-item__label) {
  font-weight: 500;
  color: #1a1a2e;
}

:deep(.el-input__wrapper) {
  border-radius: 8px;
}

.send-code-btn {
  width: 100%;
  height: 44px;
  font-weight: 500;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.send-code-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.send-code-btn:disabled {
  background: #c0c4cc;
  cursor: not-allowed;
}

.verify-btn {
  width: 100%;
  height: 44px;
  font-weight: 500;
  border-radius: 8px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.verify-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
}

.verify-btn:disabled {
  background: #c0c4cc;
  cursor: not-allowed;
}

.info-section {
  margin-top: 16px;
  padding: 12px 16px;
  background: #f0f9ff;
  border-radius: 8px;
  border: 1px solid #e0f2fe;
}

.info-text {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #0284c7;
  margin: 0;
}

.info-text .el-icon {
  font-size: 16px;
  color: #0ea5e9;
}

:deep(.el-divider) {
  margin: 20px 0;
}
</style>
