import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '@/types/auth';
import { clearRefreshQueue } from '@/api';

const ACCESS_TOKEN_KEY = 'admin-access-token';
const REFRESH_TOKEN_KEY = 'admin-refresh-token';
const USER_KEY = 'admin-user';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY));
  const user = ref<User | null>(null);

  // Initialize user from localStorage
  const storedUser = localStorage.getItem(USER_KEY);
  if (storedUser) {
    try {
      user.value = JSON.parse(storedUser);
    } catch {
      localStorage.removeItem(USER_KEY);
    }
  }

  const isAuthenticated = computed(() => !!accessToken.value);

  // Keep 'token' as alias for backward compatibility with API interceptor
  const token = computed(() => accessToken.value);

  function setTokens(tokens: AuthTokens) {
    accessToken.value = tokens.accessToken;
    refreshToken.value = tokens.refreshToken;
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }

  function setToken(newToken: string) {
    accessToken.value = newToken;
    localStorage.setItem(ACCESS_TOKEN_KEY, newToken);
  }

  function setUser(newUser: User) {
    user.value = newUser;
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }

  function logout() {
    clearRefreshQueue();
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  return {
    accessToken,
    refreshToken,
    token, // Alias for backward compatibility
    user,
    isAuthenticated,
    setTokens,
    setToken,
    setUser,
    logout,
  };
});
