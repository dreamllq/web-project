<template>
  <div class="user-avatar-component">
    <div class="avatar-wrapper">
      <el-avatar 
        :size="size" 
        :src="avatarUrl" 
        class="user-avatar"
        :class="{ 'uploading': uploading }"
      >
        <span class="avatar-placeholder">{{ placeholderText }}</span>
      </el-avatar>
      
      <div v-if="uploading" class="upload-overlay">
        <el-progress 
          type="circle" 
          :percentage="uploadProgress" 
          :width="size * 0.6"
          :stroke-width="3"
        />
      </div>
      
      <div v-if="!readonly && !uploading" class="avatar-actions">
        <el-upload
          :show-file-list="false"
          :before-upload="beforeUpload"
          :http-request="handleUpload"
          accept="image/*"
          class="avatar-upload"
        >
          <div class="upload-trigger">
            <el-icon><Camera /></el-icon>
            <span>{{ t('profile.changeAvatar') }}</span>
          </div>
        </el-upload>
      </div>
    </div>
    
    <div v-if="showInfo" class="avatar-info">
      <p class="info-text">{{ t('profile.avatarHint') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Camera } from '@element-plus/icons-vue'
import type { UploadRequestOptions, UploadRawFile } from 'element-plus'
import { useI18n } from 'vue-i18n'

interface Props {
  avatar?: string
  username?: string
  size?: number
  readonly?: boolean
  showInfo?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  avatar: '',
  username: '',
  size: 100,
  readonly: false,
  showInfo: true,
})

const emit = defineEmits<{
  (e: 'upload', file: File): void
  (e: 'success', url: string): void
  (e: 'error', error: Error): void
}>()

const { t } = useI18n()
const api = useApi()

const uploading = ref(false)
const uploadProgress = ref(0)
const previewUrl = ref('')

const avatarUrl = computed(() => previewUrl.value || props.avatar || '')

const placeholderText = computed(() => {
  return props.username?.charAt(0)?.toUpperCase() || '?'
})

const beforeUpload = (file: UploadRawFile) => {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    ElMessage.error(t('profile.avatarInvalidType'))
    return false
  }
  
  if (!isLt2M) {
    ElMessage.error(t('profile.avatarTooLarge'))
    return false
  }

  return true
}

const handleUpload = async (options: UploadRequestOptions) => {
  const file = options.file
  uploading.value = true
  uploadProgress.value = 0

  // Create preview
  const reader = new FileReader()
  reader.onload = (e) => {
    previewUrl.value = e.target?.result as string
  }
  reader.readAsDataURL(file)

  // Notify parent
  emit('upload', file)

  try {
    // Simulate upload progress
    const progressInterval = setInterval(() => {
      if (uploadProgress.value < 90) {
        uploadProgress.value += 10
      }
    }, 100)

    // Create form data
    const formData = new FormData()
    formData.append('avatar', file)

    // Upload to API
    const response = await api.post<{ url: string }>('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    } as any)

    clearInterval(progressInterval)
    uploadProgress.value = 100

    // Emit success
    emit('success', response.url)
    ElMessage.success(t('profile.avatarUploadSuccess'))
  } catch (error: any) {
    previewUrl.value = ''
    emit('error', error)
    ElMessage.error(error.message || t('profile.avatarUploadFailed'))
  } finally {
    setTimeout(() => {
      uploading.value = false
      uploadProgress.value = 0
    }, 500)
  }
}
</script>

<style scoped>
.user-avatar-component {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.avatar-wrapper {
  position: relative;
  display: inline-flex;
}

.user-avatar {
  border: 3px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  transition: all 0.3s ease;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.user-avatar.uploading {
  opacity: 0.7;
  filter: blur(2px);
}

.avatar-placeholder {
  font-size: 2em;
  font-weight: 700;
  color: white;
}

.upload-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  border-radius: 50%;
}

.avatar-actions {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.avatar-wrapper:hover .avatar-actions {
  opacity: 1;
}

.avatar-upload {
  width: 100%;
  height: 100%;
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: white;
  cursor: pointer;
  font-size: 12px;
  padding: 8px;
}

.upload-trigger:hover {
  color: #409eff;
}

.upload-trigger .el-icon {
  font-size: 24px;
}

.avatar-info {
  text-align: center;
}

.info-text {
  font-size: 12px;
  color: #909399;
  margin: 0;
}
</style>
