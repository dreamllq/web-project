<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { User } from '@element-plus/icons-vue';
import { getAdminUsers } from '@/api/admin-user';
import { extractApiError } from '@/api';
import type { AdminUserResponse } from '@/types/user';

// ============================================
// Props & Emits
// ============================================

interface Props {
  /** 已选中的用户 ID 列表 */
  modelValue: string[];
  /** 占位符文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 最大可选人数 */
  max?: number;
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  disabled: false,
  max: undefined,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void;
}>();

// ============================================
// Composables
// ============================================

const { t } = useI18n();

// ============================================
// State
// ============================================

/** 用户列表 */
const users = ref<AdminUserResponse[]>([]);
/** 加载状态 */
const loading = ref(false);
/** 搜索关键词 */
const searchKeyword = ref('');

// ============================================
// Computed
// ============================================

/** 实际显示的占位符 */
const computedPlaceholder = computed(() => {
  return props.placeholder || t('chat.selectMembers');
});

/** 根据搜索关键词过滤用户列表 */
const filteredUsers = computed(() => {
  if (!searchKeyword.value) {
    return users.value;
  }
  const keyword = searchKeyword.value.toLowerCase();
  return users.value.filter(
    (user) =>
      user.username.toLowerCase().includes(keyword) ||
      user.nickname?.toLowerCase().includes(keyword) ||
      user.email?.toLowerCase().includes(keyword)
  );
});

// ============================================
// Methods
// ============================================

/**
 * 获取用户头像 URL
 */
function getAvatarUrl(user: AdminUserResponse): string | null {
  if (!user.avatar) {
    return null;
  }
  // StorageUrlResponse 类型：local 返回 url，s3/minio 返回 key
  return user.avatar.url || null;
}

/**
 * 获取用户显示名称
 */
function getUserDisplayName(user: AdminUserResponse): string {
  return user.nickname || user.username;
}

/**
 * 加载用户列表
 */
async function loadUsers(): Promise<void> {
  loading.value = true;
  try {
    const response = await getAdminUsers({
      status: 'active',
      limit: 100, // 限制加载数量
    });
    users.value = response.data.data;
  } catch (error: unknown) {
    const apiError = extractApiError(error);
    ElMessage.error(apiError.displayMessage);
  } finally {
    loading.value = false;
  }
}

/**
 * 处理选择变化
 */
function handleChange(value: string[]): void {
  emit('update:modelValue', value);
}

/**
 * 处理远程搜索
 */
function handleRemoteSearch(query: string): void {
  searchKeyword.value = query;
}

// ============================================
// Lifecycle
// ============================================

// 组件挂载时加载用户列表
loadUsers();
</script>

<template>
  <el-select
    :model-value="modelValue"
    :placeholder="computedPlaceholder"
    :disabled="disabled"
    :loading="loading"
    :max-collapse-tags="5"
    :multiple="true"
    :filterable="true"
    :remote="true"
    :reserve-keyword="false"
    :max="max"
    value-key="id"
    class="member-selector"
    @update:model-value="handleChange"
    @remote-search="handleRemoteSearch"
  >
    <!-- 用户选项 -->
    <el-option
      v-for="user in filteredUsers"
      :key="user.id"
      :label="getUserDisplayName(user)"
      :value="user.id"
    >
      <div class="user-option">
        <!-- 用户头像 -->
        <div class="user-avatar">
          <img
            v-if="getAvatarUrl(user)"
            :src="getAvatarUrl(user)!"
            :alt="getUserDisplayName(user)"
            class="avatar-image"
          />
          <el-icon v-else :size="20" class="avatar-icon">
            <User />
          </el-icon>
        </div>
        <!-- 用户信息 -->
        <div class="user-info">
          <span class="user-name">{{ getUserDisplayName(user) }}</span>
          <span class="user-username">@{{ user.username }}</span>
        </div>
      </div>
    </el-option>
  </el-select>
</template>

<style scoped>
.member-selector {
  width: 100%;
}

.user-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background-color: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-icon {
  color: #909399;
}

.user-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.user-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-username {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
