import { useAuthStore } from '~/stores/auth';

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  data?: any;
}

// Simplified request options for internal use
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, any>;
}

// Token refresh state management
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token!);
    }
  });
  failedQueue = [];
};

export const useApi = () => {
  const config = useRuntimeConfig();
  const authStore = useAuthStore();

  const apiBase = config.public.apiBase;

  /**
   * Refresh the access token using the refresh token
   * Returns the new access token or null if refresh failed
   */
  const refreshAccessToken = async (): Promise<string | null> => {
    if (!authStore.refreshToken) {
      return null;
    }

    try {
      const response = await $fetch<{ access_token: string; refresh_token: string }>(
        `${apiBase}/auth/refresh`,
        {
          method: 'POST',
          body: { refresh_token: authStore.refreshToken },
          headers: { 'Content-Type': 'application/json' },
        }
      );

      authStore.setToken(response.access_token, response.refresh_token);
      return response.access_token;
    } catch {
      return null;
    }
  };

  /**
   * Redirect to login page
   */
  const redirectToLogin = () => {
    authStore.clearAuth();
    if (import.meta.client) {
      const currentPath = window.location.pathname + window.location.search;
      navigateTo({
        path: '/login',
        query: { redirect: currentPath },
      });
    }
  };

  const request = async <T>(url: string, options: RequestOptions = {}): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add auth token if available
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`;
    }

    const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`;

    try {
      return await $fetch<T>(fullUrl, {
        method: options.method || 'GET',
        body: options.body,
        query: options.query,
        headers,
      });
    } catch (error: any) {
      // Handle 401 errors - try to refresh token and retry
      if (error.response?.status === 401) {
        // If already refreshing, queue this request
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({
              resolve: (token: string) => {
                // Retry with new token
                headers['Authorization'] = `Bearer ${token}`;
                resolve(
                  $fetch<T>(fullUrl, {
                    method: options.method || 'GET',
                    body: options.body,
                    query: options.query,
                    headers,
                  })
                );
              },
              reject,
            });
          });
        }

        isRefreshing = true;

        try {
          const newToken = await refreshAccessToken();

          if (newToken) {
            // Token refresh successful, process queued requests
            processQueue(null, newToken);

            // Retry original request with new token
            headers['Authorization'] = `Bearer ${newToken}`;
            return await $fetch<T>(fullUrl, {
              method: options.method || 'GET',
              body: options.body,
              query: options.query,
              headers,
            });
          } else {
            // Token refresh failed, redirect to login
            processQueue(new Error('Token refresh failed'), null);
            redirectToLogin();
            throw error;
          }
        } finally {
          isRefreshing = false;
        }
      }

      throw error;
    }
  };

  const get = <T>(url: string, options: Omit<RequestOptions, 'method' | 'body'> = {}) => {
    return request<T>(url, { ...options, method: 'GET' });
  };

  const post = <T>(
    url: string,
    body?: any,
    options: Omit<RequestOptions, 'method' | 'body'> = {}
  ) => {
    return request<T>(url, { ...options, method: 'POST', body });
  };

  const put = <T>(
    url: string,
    body?: any,
    options: Omit<RequestOptions, 'method' | 'body'> = {}
  ) => {
    return request<T>(url, { ...options, method: 'PUT', body });
  };

  const del = <T>(url: string, options: Omit<RequestOptions, 'method'> = {}) => {
    return request<T>(url, { ...options, method: 'DELETE' });
  };

  const patch = <T>(
    url: string,
    body?: any,
    options: Omit<RequestOptions, 'method' | 'body'> = {}
  ) => {
    return request<T>(url, { ...options, method: 'PATCH', body });
  };

  return {
    request,
    get,
    post,
    put,
    del,
    patch,
    apiBase,
  };
};
