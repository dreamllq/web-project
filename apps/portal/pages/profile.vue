<template>
  <div class="profile-page">
    <div class="profile-container">
      <!-- Left Sidebar - User Card -->
      <aside class="profile-sidebar">
        <el-card class="user-card" shadow="hover">
          <div class="card-content">
            <UserAvatar 
              :avatar="user?.avatar" 
              :username="user?.username"
              :size="120"
              @upload="handleAvatarUpload"
              @success="handleAvatarSuccess"
              @error="handleAvatarError"
            />
            
            <div class="user-details">
              <h2 class="user-name">{{ user?.username || 'User' }}</h2>
              <p class="user-email">{{ user?.email || 'No email set' }}</p>
              
              <div class="user-meta">
                <div class="meta-item">
                  <el-icon><User /></el-icon>
                  <span>{{ user?.username }}</span>
                </div>
                <div class="meta-item">
                  <el-icon><Calendar /></el-icon>
                  <span>{{ formatDate(user?.createdAt) }}</span>
                </div>
                <div class="meta-item">
                  <el-tag :type="getStatusType(user?.status)" size="small">
                    {{ user?.status || 'active' }}
                  </el-tag>
                </div>
              </div>
            </div>
          </div>
          
          <div class="sidebar-nav">
            <NuxtLink to="/profile" class="nav-item" :class="{ active: route.path === '/profile' }">
              <el-icon><User /></el-icon>
              <span>{{ t('profile.basicInfo') }}</span>
            </NuxtLink>
            <NuxtLink to="/profile/notifications" class="nav-item" :class="{ active: route.path === '/profile/notifications' }">
              <el-icon><Bell /></el-icon>
              <span>{{ t('notifications.title') }}</span>
              <el-badge v-if="unreadCount > 0" :value="unreadCount" class="nav-badge" />
            </NuxtLink>
          </div>
        </el-card>
      </aside>
      
      <!-- Main Content -->
      <main class="profile-main">
        <el-card class="content-card" shadow="never">
          <template #header>
            <div class="card-header">
              <h1 class="page-title">{{ t('profile.title') }}</h1>
            </div>
          </template>
          
          <el-tabs v-model="activeTab" class="profile-tabs">
            <!-- Basic Info Tab -->
            <el-tab-pane :label="t('profile.basicInfo')" name="info">
              <el-form
                ref="formRef"
                :model="form"
                :rules="rules"
                label-position="top"
                class="profile-form"
              >
                <el-row :gutter="24">
                  <el-col :span="12">
                    <el-form-item :label="t('profile.username')" prop="username">
                      <el-input 
                        v-model="form.username" 
                        disabled
                        :prefix-icon="User"
                      />
                    </el-form-item>
                  </el-col>
                  
                  <el-col :span="12">
                    <el-form-item :label="t('profile.nickname')" prop="nickname">
                      <el-input 
                        v-model="form.nickname" 
                        :placeholder="t('profile.nicknamePlaceholder')"
                        :prefix-icon="User"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
                
                <el-row :gutter="24">
                  <el-col :span="12">
                    <el-form-item :label="t('profile.email')" prop="email">
                      <el-input 
                        v-model="form.email" 
                        :placeholder="t('profile.emailPlaceholder')"
                        :prefix-icon="Message"
                      />
                    </el-form-item>
                  </el-col>
                  
                  <el-col :span="12">
                    <el-form-item :label="t('profile.phone')" prop="phone">
                      <el-input 
                        v-model="form.phone" 
                        :placeholder="t('profile.phonePlaceholder')"
                        :prefix-icon="Phone"
                      />
                    </el-form-item>
                  </el-col>
                </el-row>
                
                <el-form-item>
                  <el-button 
                    type="primary" 
                    :loading="loading" 
                    @click="handleSave"
                    class="save-btn"
                  >
                    <el-icon><Check /></el-icon>
                    {{ t('common.save') }}
                  </el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>
            
            <!-- Change Password Tab -->
            <el-tab-pane :label="t('profile.changePassword')" name="password">
              <el-form
                ref="passwordFormRef"
                :model="passwordForm"
                :rules="passwordRules"
                label-position="top"
                class="profile-form"
              >
                <el-form-item :label="t('profile.currentPassword')" prop="currentPassword">
                  <el-input 
                    v-model="passwordForm.currentPassword" 
                    type="password"
                    show-password
                    :prefix-icon="Lock"
                  />
                </el-form-item>
                
                <el-form-item :label="t('profile.newPassword')" prop="newPassword">
                  <el-input 
                    v-model="passwordForm.newPassword" 
                    type="password"
                    show-password
                    :prefix-icon="Lock"
                  />
                </el-form-item>
                
                <el-form-item :label="t('profile.confirmPassword')" prop="confirmPassword">
                  <el-input 
                    v-model="passwordForm.confirmPassword" 
                    type="password"
                    show-password
                    :prefix-icon="Lock"
                  />
                </el-form-item>
                
                <el-form-item>
                  <el-button 
                    type="primary" 
                    :loading="passwordLoading" 
                    @click="handleChangePassword"
                    class="save-btn"
                  >
                    <el-icon><Key /></el-icon>
                    {{ t('profile.changePassword') }}
                  </el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, Message, Phone, Lock, Check, Key, Calendar, Bell } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules } from 'element-plus'

definePageMeta({
  middleware: 'auth',
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { user, fetchUser } = useAuth()
const api = useApi()

const formRef = ref<FormInstance>()
const passwordFormRef = ref<FormInstance>()
const activeTab = ref('info')
const loading = ref(false)
const passwordLoading = ref(false)
const unreadCount = ref(0)

// Profile form
const form = reactive({
  username: '',
  nickname: '',
  email: '',
  phone: '',
})

// Password form
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

// Profile form rules
const rules: FormRules = {
  nickname: [
    { max: 50, message: t('profile.validation.nicknameMax'), trigger: 'blur' },
  ],
  email: [
    { type: 'email', message: t('auth.validation.emailInvalid'), trigger: 'blur' },
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: t('auth.validation.phoneInvalid'), trigger: 'blur' },
  ],
}

// Password form rules
const passwordRules: FormRules = {
  currentPassword: [
    { required: true, message: t('profile.validation.currentPasswordRequired'), trigger: 'blur' },
  ],
  newPassword: [
    { required: true, message: t('auth.validation.passwordRequired'), trigger: 'blur' },
    { min: 8, message: t('auth.validation.passwordMin'), trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: t('profile.validation.confirmPasswordRequired'), trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== passwordForm.newPassword) {
          callback(new Error(t('auth.validation.passwordMatch')))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

// Initialize form with user data
watchEffect(() => {
  if (user.value) {
    form.username = user.value.username || ''
    form.nickname = (user.value as any).nickname || ''
    form.email = user.value.email || ''
    form.phone = user.value.phone || ''
  }
})

// Fetch user data on mount
onMounted(async () => {
  await fetchUser()
  await fetchUnreadCount()
})

const fetchUnreadCount = async () => {
  try {
    const response = await api.get<{ count: number }>('/notifications/unread-count')
    unreadCount.value = response.count
  } catch {
    // Ignore errors for unread count
  }
}

const handleAvatarUpload = (file: File) => {
  console.log('Uploading avatar:', file.name)
}

const handleAvatarSuccess = (url: string) => {
  // Update user avatar in store
  if (user.value) {
    user.value.avatar = url
  }
}

const handleAvatarError = (error: Error) => {
  console.error('Avatar upload error:', error)
}

const handleSave = async () => {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  
  loading.value = true
  
  try {
    await api.put('/users/me', {
      nickname: form.nickname,
      email: form.email,
      phone: form.phone,
    })
    
    await fetchUser()
    ElMessage.success(t('profile.updateSuccess'))
  } catch (error: any) {
    ElMessage.error(error.message || t('profile.updateFailed'))
  } finally {
    loading.value = false
  }
}

const handleChangePassword = async () => {
  if (!passwordFormRef.value) return
  
  try {
    await passwordFormRef.value.validate()
  } catch {
    return
  }
  
  passwordLoading.value = true
  
  try {
    await api.put('/users/me/password', {
      currentPassword: passwordForm.currentPassword,
      newPassword: passwordForm.newPassword,
    })
    
    ElMessage.success(t('profile.passwordChangeSuccess'))
    
    // Clear form
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
  } catch (error: any) {
    ElMessage.error(error.message || t('profile.passwordChangeFailed'))
  } finally {
    passwordLoading.value = false
  }
}

const formatDate = (date?: string) => {
  if (!date) return '-'
  return new Date(date).toLocaleDateString()
}

const getStatusType = (status?: string) => {
  switch (status) {
    case 'active':
      return 'success'
    case 'inactive':
      return 'warning'
    case 'banned':
      return 'danger'
    default:
      return 'info'
  }
}

// Redirect to notifications if on that path
if (route.path === '/profile/notifications') {
  router.push('/profile/notifications')
}
</script>

<style scoped>
.profile-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
  min-height: calc(100vh - 200px);
}

.profile-container {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;
}

/* Sidebar Styles */
.profile-sidebar {
  position: sticky;
  top: 88px;
  height: fit-content;
}

.user-card {
  border-radius: 16px;
  border: none;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.user-card :deep(.el-card__body) {
  padding: 24px;
}

.card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.user-details {
  text-align: center;
  margin-top: 20px;
  width: 100%;
}

.user-name {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 4px;
}

.user-email {
  font-size: 13px;
  color: #909399;
  margin: 0 0 16px;
}

.user-meta {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 16px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  text-decoration: none;
  color: #606266;
  border-radius: 10px;
  transition: all 0.2s ease;
  font-size: 14px;
  font-weight: 500;
}

.nav-item:hover {
  background: rgba(102, 126, 234, 0.08);
  color: #667eea;
}

.nav-item.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.nav-badge {
  margin-left: auto;
}

/* Main Content Styles */
.profile-main {
  min-width: 0;
}

.content-card {
  border-radius: 16px;
  border: none;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
}

.content-card :deep(.el-card__header) {
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.content-card :deep(.el-card__body) {
  padding: 0;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0;
}

.profile-tabs {
  padding: 0 24px 24px;
}

.profile-tabs :deep(.el-tabs__header) {
  margin-bottom: 24px;
}

.profile-tabs :deep(.el-tabs__item) {
  font-size: 14px;
  font-weight: 500;
}

.profile-tabs :deep(.el-tabs__item.is-active) {
  color: #667eea;
}

.profile-tabs :deep(.el-tabs__active-bar) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.profile-form {
  max-width: 600px;
}

.profile-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #374151;
}

.profile-form :deep(.el-input__wrapper) {
  border-radius: 10px;
}

.save-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 10px;
  padding: 12px 32px;
  font-weight: 600;
  transition: all 0.3s ease;
}

.save-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
}

/* Responsive */
@media (max-width: 992px) {
  .profile-container {
    grid-template-columns: 1fr;
  }
  
  .profile-sidebar {
    position: static;
  }
}

@media (max-width: 576px) {
  .profile-page {
    padding: 16px;
  }
  
  .profile-form :deep(.el-col) {
    max-width: 100%;
    flex: 0 0 100%;
  }
}
</style>
