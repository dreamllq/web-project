<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage, ElMessageBox } from 'element-plus';
import { User, Delete } from '@element-plus/icons-vue';
import { useChatStore } from '@/stores/chat';
import type { MemberWithUserResponse, MemberRole } from '@/types/chat';

// ============================================
// Props & Emits
// ============================================

interface Props {
  /** 对话框可见性 */
  modelValue: boolean;
  /** 房间 ID */
  roomId: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

// ============================================
// Composables
// ============================================

const { t } = useI18n();
const chatStore = useChatStore();

// ============================================
// State
// ============================================

/** 成员列表 */
const members = ref<MemberWithUserResponse[]>([]);
/** 加载状态 */
const isLoading = ref(false);

// ============================================
// Computed
// ============================================

/** 对话框可见性双向绑定 */
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
});

/** 当前房间信息 */
const currentRoom = computed(() => {
  return chatStore.rooms.find((r) => r.room.id === props.roomId);
});

/** 当前用户在房间中的角色 */
const currentUserRole = computed(() => {
  return currentRoom.value?.role;
});

/** 是否可以移除成员 (群聊且是管理员或创建者) */
const canRemoveMembers = computed(() => {
  if (!currentRoom.value) return false;
  // 私聊不能移除成员
  if (currentRoom.value.room.type === 'private') return false;
  // 只有创建者和管理员可以移除成员
  return currentUserRole.value === 'owner' || currentUserRole.value === 'admin';
});

// ============================================
// Methods
// ============================================

/**
 * 加载成员列表
 */
async function loadMembers(): Promise<void> {
  isLoading.value = true;
  try {
    members.value = await chatStore.fetchRoomMembers(props.roomId);
  } catch (error) {
    console.error('Failed to load members:', error);
  } finally {
    isLoading.value = false;
  }
}

/**
 * 处理移除成员
 */
async function handleRemoveMember(member: MemberWithUserResponse): Promise<void> {
  try {
    await ElMessageBox.confirm(t('chat.removeMemberConfirm'), t('common.warning'), {
      confirmButtonText: t('common.confirm'),
      cancelButtonText: t('common.cancel'),
      type: 'warning',
    });

    await chatStore.removeRoomMember(props.roomId, member.userId);
    ElMessage.success(t('chat.memberRemoved'));
    // 重新加载成员列表
    await loadMembers();
  } catch {
    // 用户取消或发生错误
  }
}

/**
 * 关闭对话框
 */
function handleClose(): void {
  dialogVisible.value = false;
}

/**
 * 获取角色标签文本
 */
function getRoleLabel(role: MemberRole): string {
  switch (role) {
    case 'owner':
      return t('chat.owner');
    case 'admin':
      return t('chat.admin');
    default:
      return t('chat.member');
  }
}

/**
 * 获取角色标签类型
 */
function getRoleType(role: MemberRole): 'danger' | 'warning' | 'info' {
  switch (role) {
    case 'owner':
      return 'danger';
    case 'admin':
      return 'warning';
    default:
      return 'info';
  }
}

// ============================================
// Watchers
// ============================================

// 监听对话框打开，加载成员列表
watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen && props.roomId) {
      await loadMembers();
    }
  }
);
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    :title="t('chat.members')"
    width="400px"
    class="member-manager-dialog"
    @close="handleClose"
  >
    <div v-loading="isLoading" class="member-list">
      <el-empty v-if="!isLoading && members.length === 0" :description="t('chat.noMembers')" />

      <div v-for="member in members" :key="member.id" class="member-item">
        <div class="member-info">
          <el-avatar :size="36" :icon="User" />
          <div class="member-details">
            <span class="member-name">{{ member.user?.username || member.userId }}</span>
            <el-tag :type="getRoleType(member.role)" size="small">{{
              getRoleLabel(member.role)
            }}</el-tag>
          </div>
        </div>

        <el-button
          v-if="canRemoveMembers && member.role !== 'owner'"
          :icon="Delete"
          circle
          size="small"
          type="danger"
          @click="handleRemoveMember(member)"
        />
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.member-manager-dialog :deep(.el-dialog__body) {
  padding: 16px 24px;
}

.member-list {
  max-height: 400px;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #ebeef5;
}

.member-item:last-child {
  border-bottom: none;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.member-details {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

/* Element Plus 样式覆盖 */
:deep(.el-dialog) {
  border-radius: 12px;
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid #ebeef5;
  padding-bottom: 16px;
  margin-right: 0;
}

:deep(.el-dialog__title) {
  font-weight: 600;
  color: #1a1a2e;
}
</style>
