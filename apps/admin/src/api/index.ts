import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

// Token refresh state management
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

/**
 * Process queued requests after token refresh completes
 */
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token!);
    }
  });
  failedQueue = [];
};

/**
 * Clear the refresh queue and reject all pending requests
 * Should be called when user logs out to clean up pending requests
 */
export const clearRefreshQueue = () => {
  if (failedQueue.length > 0) {
    processQueue(new Error('Request cancelled due to logout'), null);
  }
  isRefreshing = false;
};

/**
 * Refresh the access token using the refresh token
 * Uses raw axios instance to avoid interceptor loop
 */
const refreshAccessToken = async (): Promise<string | null> => {
  const authStore = useAuthStore();
  if (!authStore.refreshToken) {
    return null;
  }

  try {
    const response = await axios.post<{ access_token: string; refresh_token: string }>(
      '/api/auth/refresh',
      { refresh_token: authStore.refreshToken },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    authStore.setTokens({
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: 0,
    });

    return response.data.access_token;
  } catch {
    return null;
  }
};

/**
 * Redirect to login page with current path as redirect parameter
 */
const redirectToLogin = () => {
  const authStore = useAuthStore();
  authStore.logout();
  const currentPath = window.location.pathname + window.location.search;
  router.push({ name: 'Login', query: { redirect: currentPath } });
};

/**
 * Standardized API error interface matching backend response
 */
export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  timestamp?: string;
  path?: string;
  /** Formatted message for display: "[statusCode] message" */
  displayMessage: string;
}

/**
 * Extract ApiError from axios error response
 */
export function extractApiError(error: unknown): ApiError {
  const axiosError = error as AxiosError<{
    statusCode?: number;
    message?: string;
    error?: string;
    timestamp?: string;
    path?: string;
  }>;

  const response = axiosError.response;

  if (response?.data) {
    const data = response.data;
    const statusCode = data.statusCode || response.status || 500;
    const message = data.message || 'An error occurred';
    const errorType = data.error || 'Error';

    return {
      statusCode,
      message,
      error: errorType,
      timestamp: data.timestamp,
      path: data.path,
      displayMessage: `[${statusCode}] ${message}`,
    };
  }

  // Network error or other issues
  if (axiosError.code === 'ECONNABORTED' || axiosError.message.includes('timeout')) {
    return {
      statusCode: 408,
      message: 'Request timeout',
      error: 'TimeoutError',
      displayMessage: '[408] 请求超时，请稍后重试',
    };
  }

  if (!axiosError.response) {
    return {
      statusCode: 0,
      message: 'Network error',
      error: 'NetworkError',
      displayMessage: '[0] 网络错误，请检查网络连接',
    };
  }

  return {
    statusCode: axiosError.response.status || 500,
    message: axiosError.message || 'Unknown error',
    error: 'UnknownError',
    displayMessage: `[${axiosError.response.status || 500}] ${axiosError.message || 'Unknown error'}`,
  };
}

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore();
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`;
    }
    // If data is FormData, remove Content-Type to let browser set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors with automatic token refresh
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Handle 401 errors - try to refresh token and retry
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(api.request(originalRequest));
            },
            reject: (err: Error) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      return new Promise((resolve, reject) => {
        refreshAccessToken()
          .then((newToken) => {
            if (newToken) {
              // Token refresh successful, process queued requests
              processQueue(null, newToken);

              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(api.request(originalRequest));
            } else {
              // Token refresh failed, redirect to login
              processQueue(new Error('Token refresh failed'), null);
              redirectToLogin();
              reject(error);
            }
          })
          .catch((err) => {
            processQueue(err, null);
            redirectToLogin();
            reject(err);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    // Attach formatted error info
    const apiError = extractApiError(error);
    (error as AxiosError & { apiError: ApiError }).apiError = apiError;

    return Promise.reject(error);
  }
);

export * from './user';

export default api;
