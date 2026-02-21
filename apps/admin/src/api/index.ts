import axios, { type AxiosError } from 'axios';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

/**
 * ABAC permission error details from backend
 */
export interface PermissionDetails {
  resource: string;
  action: string;
  reason: string;
  matchedPolicies: Array<{ id: string; name: string }>;
  suggestion?: string;
}

/**
 * Standardized API error interface matching backend response
 */
export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  timestamp?: string;
  path?: string;
  /** ABAC permission details for 403 errors */
  details?: PermissionDetails;
  /** Suggestion for resolving the error (from ABAC details) */
  suggestion?: string;
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
    details?: PermissionDetails;
  }>;

  const response = axiosError.response;

  if (response?.data) {
    const data = response.data;
    const statusCode = data.statusCode || response.status || 500;
    const message = data.message || 'An error occurred';
    const errorType = data.error || 'Error';
    const details = data.details;
    const suggestion = details?.suggestion;

    // Build display message with suggestion for 403 errors
    let displayMessage = `[${statusCode}] ${message}`;
    if (statusCode === 403 && suggestion) {
      displayMessage = `[${statusCode}] ${message}\n💡 ${suggestion}`;
    }

    return {
      statusCode,
      message,
      error: errorType,
      timestamp: data.timestamp,
      path: data.path,
      details,
      suggestion,
      displayMessage,
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
