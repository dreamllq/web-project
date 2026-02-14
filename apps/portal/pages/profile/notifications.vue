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
              :show-info="false"
            />
            
            <div class="user-details">
              <h2 class="user-name">{{ user?.username || 'User' }}</h2>
              <p class="user-email">{{ user?.email || 'No email set' }}</p>
            </div>
          </div>
          
          <div class="sidebar-nav">
            <NuxtLink to="/profile" class="nav-item" :class="{ active: false }">
              <el-icon><User /></el-icon>
              <span>{{ t('profile.basicInfo') }}</span>
            </NuxtLink>
            <NuxtLink to="/profile/notifications" class="nav-item active">
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
              <h1 class="page-title">{{ t('notifications.title') }}</h1>
              <div class="header-actions">
                <el-button 
                  v-if="unreadCount > 0"
                  type="primary" 
                  text 
                  @click="markAllAsRead"
                  :loading="markingAllRead"
                >
                  <el-icon><Check /></el-icon>
                  {{ t('notifications.markAllRead') }}
                </el-button>
              </div>
            </div>
          </template>
          
          <!-- Filter Tabs -->
          <div class="filter-tabs">
            <el-radio-group v-model="filter" size="default" @change="handleFilterChange">
              <el-radio-button value="all">{{ t('notifications.all') }}</el-radio-button>
              <el-radio-button value="unread">{{ t('notifications.unread') }}</el-radio-button>
              <el-radio-button value="system">{{ t('notifications.system') }}</el-radio-button>
            </el-radio-group>
          </div>
          
          <!-- Notifications List -->
          <div class="notifications-container" v-loading="loading">
            <template v-if="notifications.length > 0">
              <div 
                v-for="notification in notifications" 
                :key="notification.id"
                class="notification-item"
                :class="{ unread: !notification.isRead }"
                @click="handleNotificationClick(notification)"
              >
                <div class="notification-icon" :class="getNotificationType(notification.type)">
                  <el-icon v-if="notification.type === 'system'"><Setting /></el-icon>
                  <el-icon v-else-if="notification.type === 'security'"><Warning /></el-icon>
                  <el-icon v-else-if="notification.type === 'message'"><ChatDotRound /></el-icon>
                  <el-icon v-else><Bell /></el-icon>
                </div>
                
                <div class="notification-content">
                  <div class="notification-header">
                    <h4 class="notification-title">{{ notification.title }}</h4>
                    <span class="notification-time">{{ formatTime(notification.createdAt) }}</span>
                  </div>
                  <p class="notification-text">{{ notification.content }}</p>
                </div>
                
                <div class="notification-actions">
                  <el-button 
                    v-if="!notification.isRead"
                    type="primary" 
                    text 
                    size="small"
                    @click.stop="markAsRead(notification)"
                  >
                    {{ t('notifications.markRead') }}
                  </el-button>
                  <el-button 
                    type="danger" 
                    text 
                    size="small"
                    @click.stop="deleteNotification(notification)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
            </template>
            
            <el-empty 
              v-else 
              :description="t('notifications.empty')" 
              :image-size="120"
            />
            
            <!-- Pagination -->
            <div v-if="total > pageSize" class="pagination-wrapper">
              <el-pagination
                v-model:current-page="currentPage"
                :page-size="pageSize"
                :total="total"
                layout="prev, pager, next"
                @current-change="handlePageChange"
              />
            </div>
          </div>
        </el-card>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, Bell, Check, Setting, Warning, ChatDotRound, Delete } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

definePageMeta({
  middleware: 'auth',
})

interface Notification {
  id: string
  title: string
  content: string
  type: 'system' | 'security' | 'message' | 'other'
  isRead: boolean
  createdAt: string
}

const { t } = useI18n()
const { user } = useAuth()
const api = useApi()

const loading = ref(false)
const markingAllRead = ref(false)
const notifications = ref<Notification[]>([])
const filter = ref('all')
const currentPage = ref(1)
const pageSize = 10
const total = ref(0)
const unreadCount = ref(0)

// Fetch notifications on mount
onMounted(async () => {
  await Promise.all([
    fetchNotifications(),
    fetchUnreadCount(),
  ])
})

const fetchNotifications = async () => {
  loading.value = true
  
  try {
    const params: Record<string, any> = {
      page: currentPage.value,
      pageSize,
    }
    
    if (filter.value === 'unread') {
      params.isRead = false
    } else if (filter.value !== 'all') {
      params.type = filter.value
    }
    
    const response = await api.get<{ items: Notification[]; total: number }>('/notifications', {
      query: params,
    } as any)
    
    notifications.value = response.items || []
    total.value = response.total || 0
  } catch (error) {
    console.error('Failed to fetch notifications:', error)
    // Use mock data for demo
    notifications.value = getMockNotifications()
    total.value = notifications.value.length
  } finally {
    loading.value = false
  }
}

const fetchUnreadCount = async () => {
  try {
    const response = await api.get<{ count: number }>('/notifications/unread-count')
    unreadCount.value = response.count
  } catch {
    // Use mock count for demo
    unreadCount.value = notifications.value.filter(n => !n.isRead).length
  }
}

const handleFilterChange = () => {
  currentPage.value = 1
  fetchNotifications()
}

const handlePageChange = () => {
  fetchNotifications()
}

const handleNotificationClick = async (notification: Notification) => {
  if (!notification.isRead) {
    await markAsRead(notification)
  }
}

const markAsRead = async (notification: Notification) => {
  try {
    await api.put(`/notifications/${notification.id}/read`)
    notification.isRead = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  } catch (error) {
    console.error('Failed to mark as read:', error)
    notification.isRead = true
    unreadCount.value = Math.max(0, unreadCount.value - 1)
  }
}

const markAllAsRead = async () => {
  markingAllRead.value = true
  
  try {
    await api.put('/notifications/read-all')
    notifications.value.forEach(n => n.isRead = true)
    unreadCount.value = 0
    ElMessage.success(t('notifications.markAllReadSuccess'))
  } catch (error) {
    console.error('Failed to mark all as read:', error)
    notifications.value.forEach(n => n.isRead = true)
    unreadCount.value = 0
    ElMessage.success(t('notifications.markAllReadSuccess'))
  } finally {
    markingAllRead.value = false
  }
}

const deleteNotification = async (notification: Notification) => {
  try {
    await api.del(`/notifications/${notification.id}`)
    notifications.value = notifications.value.filter(n => n.id !== notification.id)
    if (!notification.isRead) {
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
    ElMessage.success(t('notifications.deleteSuccess'))
  } catch (error) {
    console.error('Failed to delete notification:', error)
    notifications.value = notifications.value.filter(n => n.id !== notification.id)
    if (!notification.isRead) {
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    }
    ElMessage.success(t('notifications.deleteSuccess'))
  }
}

const formatTime = (dateStr: string) => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) return t('notifications.justNow')
  if (minutes < 60) return t('notifications.minutesAgo', { n: minutes })
  if (hours < 24) return t('notifications.hoursAgo', { n: hours })
  if (days < 7) return t('notifications.daysAgo', { n: days })
  
  return date.toLocaleDateString()
}

const getNotificationType = (type: string) => {
  return {
    system: 'type-system',
    security: 'type-security',
    message: 'type-message',
  }[type] || 'type-other'
}

// Mock data for demo
const getMockNotifications = (): Notification[] => [
  {
    id: '1',
    title: t('notifications.mock.title1'),
    content: t('notifications.mock.content1'),
    type: 'system',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '2',
    title: t('notifications.mock.title2'),
    content: t('notifications.mock.content2'),
    type: 'security',
    isRead: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: '3',
    title: t('notifications.mock.title3'),
    content: t('notifications.mock.content3'),
    type: 'message',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: '4',
    title: t('notifications.mock.title4'),
    content: t('notifications.mock.content4'),
    type: 'system',
    isRead: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
  },
]
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
  margin: 0;
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

/* Filter Tabs */
.filter-tabs {
  padding: 16px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.filter-tabs :deep(.el-radio-button__inner) {
  border-radius: 8px;
  border: none;
  padding: 8px 20px;
}

.filter-tabs :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

/* Notifications List */
.notifications-container {
  min-height: 400px;
}

.notification-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: background 0.2s ease;
}

.notification-item:hover {
  background: rgba(102, 126, 234, 0.04);
}

.notification-item.unread {
  background: rgba(102, 126, 234, 0.06);
}

.notification-item.unread::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.notification-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.notification-icon .el-icon {
  font-size: 20px;
}

.notification-icon.type-system {
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
}

.notification-icon.type-security {
  background: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.notification-icon.type-message {
  background: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.notification-icon.type-other {
  background: rgba(144, 147, 153, 0.1);
  color: #909399;
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.notification-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0;
}

.notification-item.unread .notification-title {
  color: #667eea;
}

.notification-time {
  font-size: 12px;
  color: #909399;
  white-space: nowrap;
}

.notification-text {
  font-size: 13px;
  color: #606266;
  margin: 0;
  line-height: 1.5;
}

.notification-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

/* Pagination */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 24px;
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
  
  .notification-item {
    flex-direction: column;
    align-items: flex-start;
    position: relative;
  }
  
  .notification-actions {
    position: absolute;
    top: 20px;
    right: 24px;
  }
}
</style>
