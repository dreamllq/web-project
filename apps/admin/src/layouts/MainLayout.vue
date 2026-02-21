<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const { t } = useI18n();
const authStore = useAuthStore();

const currentRoute = computed(() => route.path);

function logout() {
  authStore.logout();
  router.push({ name: 'Login' });
}
</script>

<template>
  <el-container class="main-layout">
    <!-- Sidebar -->
    <el-aside width="200px" class="sidebar">
      <div class="logo">
        <h2>4A Admin</h2>
      </div>
      <el-menu
        router
        :default-active="currentRoute"
        class="sidebar-menu"
        background-color="#001529"
        text-color="rgba(255, 255, 255, 0.85)"
        active-text-color="#fff"
      >
        <el-menu-item index="/admin">
          <el-icon><HomeFilled /></el-icon>
          <span>{{ t('menu.dashboard') }}</span>
        </el-menu-item>
        <el-menu-item index="/admin/users">
          <el-icon><User /></el-icon>
          <span>{{ t('menu.users') }}</span>
        </el-menu-item>
        <el-menu-item index="/admin/audit-logs">
          <el-icon><Document /></el-icon>
          <span>{{ t('menu.auditLogs') }}</span>
        </el-menu-item>
        <el-menu-item index="/admin/devices">
          <el-icon><Monitor /></el-icon>
          <span>{{ t('menu.devices') }}</span>
        </el-menu-item>
        <el-menu-item index="/admin/login-history">
          <el-icon><Clock /></el-icon>
          <span>{{ t('menu.loginHistory') }}</span>
        </el-menu-item>
        <el-menu-item index="/admin/policies">
          <el-icon><Setting /></el-icon>
          <span>{{ t('menu.policies') }}</span>
        </el-menu-item>
        <el-menu-item index="/admin/roles">
          <el-icon><Avatar /></el-icon>
          <span>{{ t('menu.roles') }}</span>
        </el-menu-item>
        <el-menu-item index="/admin/permissions">
          <el-icon><Lock /></el-icon>
          <span>{{ t('menu.permissions') }}</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- Main Content -->
    <el-container class="main-container">
      <!-- Header -->
      <el-header class="header">
        <div class="header-content">
          <div class="breadcrumb">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/admin' }">{{
                t('menu.dashboard')
              }}</el-breadcrumb-item>
              <el-breadcrumb-item v-if="route.name && route.name !== 'Dashboard'">
                {{ t(`menu.${String(route.name).toLowerCase()}`) }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <div class="user-section">
            <el-dropdown trigger="click">
              <span class="user-dropdown">
                <el-icon><UserFilled /></el-icon>
                <span class="username">{{ authStore.user?.username || 'Admin' }}</span>
                <el-icon><ArrowDown /></el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="router.push('/admin/profile')">
                    <el-icon><User /></el-icon>
                    {{ t('header.profile') }}
                  </el-dropdown-item>
                  <el-dropdown-item @click="router.push('/admin/change-password')">
                    <el-icon><Setting /></el-icon>
                    {{ t('header.settings') }}
                  </el-dropdown-item>
                  <el-dropdown-item @click="router.push('/admin/two-factor-settings')">
                    <el-icon><Lock /></el-icon>
                    Two-Factor Auth
                  </el-dropdown-item>
                  <el-dropdown-item @click="router.push('/admin/phone-verification')">
                    <el-icon><Phone /></el-icon>
                    Phone Verification
                  </el-dropdown-item>
                  <el-dropdown-item divided @click="logout">
                    <el-icon><SwitchButton /></el-icon>
                    {{ t('header.logout') }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </el-header>

      <!-- Content -->
      <el-main class="content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.main-layout {
  height: 100vh;
}

.sidebar {
  background-color: #001529;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.sidebar-menu {
  border-right: none;
}

.sidebar-menu .el-menu-item {
  height: 50px;
  line-height: 50px;
}

.sidebar-menu .el-menu-item:hover {
  background-color: rgba(255, 255, 255, 0.08) !important;
}

.sidebar-menu .el-menu-item.is-active {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%) !important;
  color: #fff !important;
}

.main-container {
  background-color: #f5f7fa;
}

.header {
  background-color: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  padding: 0 24px;
  display: flex;
  align-items: center;
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.breadcrumb {
  font-size: 14px;
}

.user-section {
  display: flex;
  align-items: center;
}

.user-dropdown {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.user-dropdown:hover {
  background-color: #f5f7fa;
}

.username {
  font-size: 14px;
  color: #333;
}

.content {
  padding: 24px;
  min-height: calc(100vh - 60px);
}
</style>
