import { useAuthStore } from '~/stores/auth';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  password: string;
  email?: string;
  phone?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    username: string;
    email?: string;
    phone?: string;
    status: string;
  };
}

export interface WechatOAuthUrlResponse {
  url: string;
}

export const useAuth = () => {
  const authStore = useAuthStore();
  const api = useApi();
  const router = useRouter();

  // Initialize auth state on first use
  const isInitialized = ref(false);

  const initAuth = () => {
    if (!isInitialized.value) {
      authStore.initAuth();
      isInitialized.value = true;
    }
  };

  const login = async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      const response = await api.post<AuthResponse>('/auth/login', credentials);

      authStore.setAuth({
        user: response.user as any,
        token: response.access_token,
        refreshToken: response.refresh_token,
      });

      return response;
    } catch (error: any) {
      throw new Error(error.data?.message || 'Login failed');
    }
  };

  const register = async (data: RegisterData): Promise<AuthResponse> => {
    try {
      const response = await api.post<AuthResponse>('/auth/register', data);

      authStore.setAuth({
        user: response.user as any,
        token: response.access_token,
        refreshToken: response.refresh_token,
      });

      return response;
    } catch (error: any) {
      throw new Error(error.data?.message || 'Registration failed');
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Ignore logout API errors, still clear local state
      console.error('Logout API error:', error);
    } finally {
      authStore.clearAuth();
      router.push('/');
    }
  };

  const refreshToken = async (): Promise<string | null> => {
    if (!authStore.refreshToken) {
      return null;
    }

    try {
      const response = await api.post<AuthResponse>('/auth/refresh', {
        refresh_token: authStore.refreshToken,
      });

      authStore.setToken(response.access_token, response.refresh_token);
      return response.access_token;
    } catch {
      authStore.clearAuth();
      return null;
    }
  };

  const fetchUser = async () => {
    if (!authStore.token) {
      return null;
    }

    try {
      const user = await api.get('/users/me');
      authStore.setUser(user as any);
      return user;
    } catch {
      return null;
    }
  };

  const requireAuth = (redirectPath = '/') => {
    if (!authStore.isLoggedIn) {
      router.push(redirectPath);
      return false;
    }
    return true;
  };

  // WeChat OAuth methods
  const getWechatLoginUrl = async (): Promise<string> => {
    try {
      const response = await api.get<WechatOAuthUrlResponse>('/auth/oauth/wechat/url');
      return response.url;
    } catch (error: any) {
      throw new Error(error.data?.message || 'Failed to get WeChat login URL');
    }
  };

  const handleWechatLogin = async () => {
    try {
      const url = await getWechatLoginUrl();
      window.location.href = url;
    } catch (error: any) {
      throw new Error(error.data?.message || 'Failed to initiate WeChat login');
    }
  };

  // Handle OAuth callback with tokens from URL
  const handleOAuthCallback = (accessToken: string, refreshTokenValue: string, userData?: any) => {
    if (accessToken) {
      authStore.setAuth({
        user: userData || { id: '', username: '', status: 'active' },
        token: accessToken,
        refreshToken: refreshTokenValue || '',
      });
    }
  };

  // Run init on client-side
  if (import.meta.client) {
    initAuth();
  }

  return {
    user: computed(() => authStore.user),
    token: computed(() => authStore.token),
    isAuthenticated: computed(() => authStore.isLoggedIn),
    login,
    register,
    logout,
    refreshToken,
    fetchUser,
    requireAuth,
    initAuth,
    getWechatLoginUrl,
    handleWechatLogin,
    handleOAuthCallback,
  };
};
