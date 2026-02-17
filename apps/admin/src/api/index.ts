import axios, { type AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

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
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Auto logout on 401
    if (error.response?.status === 401) {
      const authStore = useAuthStore();
      authStore.logout();
      router.push({ name: 'Login' });
    }

    // Attach formatted error info
    const apiError = extractApiError(error);
    (error as AxiosError & { apiError: ApiError }).apiError = apiError;

    return Promise.reject(error);
  }
);

export * from './user';

export default api;
