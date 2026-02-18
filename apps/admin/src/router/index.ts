import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { guest: true },
  },
  {
    path: '/admin',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Home.vue'),
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/Users.vue'),
      },
      {
        path: 'policies',
        name: 'Policies',
        component: () => import('@/views/Policies.vue'),
      },
      {
        path: 'audit-logs',
        name: 'AuditLogs',
        component: () => import('@/views/AuditLogs.vue'),
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/Profile.vue'),
      },
      {
        path: 'change-password',
        name: 'ChangePassword',
        component: () => import('@/views/ChangePassword.vue'),
      },
      {
        path: 'devices',
        name: 'DeviceManagement',
        component: () => import('@/views/DeviceManagement.vue'),
      },
      {
        path: 'login-history',
        name: 'LoginHistory',
        component: () => import('@/views/LoginHistory.vue'),
      },
    ],
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('@/views/ForgotPassword.vue'),
    meta: { guest: true },
  },
  {
    path: '/reset-password',
    name: 'ResetPassword',
    component: () => import('@/views/ResetPassword.vue'),
    meta: { guest: true },
  },
  {
    path: '/',
    redirect: '/admin',
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/admin',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } });
  } else if (to.meta.guest && authStore.isAuthenticated) {
    next({ name: 'Dashboard' });
  } else {
    next();
  }
});

export default router;
