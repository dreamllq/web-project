import type { UseFetchOptions } from 'nuxt/app'
import { useAuthStore } from '~/stores/auth'

export interface ApiResponse<T = any> {
  data: T
  message?: string
  success: boolean
}

export interface ApiError {
  statusCode: number
  message: string
  data?: any
}

export const useApi = () => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()

  const apiBase = config.public.apiBase

  const request = async <T>(
    url: string,
    options: UseFetchOptions<T> = {}
  ): Promise<T> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    // Add auth token if available
    if (authStore.token) {
      headers['Authorization'] = `Bearer ${authStore.token}`
    }

    const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`

    return $fetch<T>(fullUrl, {
      ...options,
      headers,
      onResponseError({ response }) {
        // Handle 401 errors - clear auth and redirect to login
        if (response.status === 401) {
          authStore.clearAuth()
          // Could redirect to login page here
        }
      },
    })
  }

  const get = <T>(url: string, options: UseFetchOptions<T> = {}) => {
    return request<T>(url, { ...options, method: 'GET' })
  }

  const post = <T>(url: string, body?: any, options: UseFetchOptions<T> = {}) => {
    return request<T>(url, { ...options, method: 'POST', body })
  }

  const put = <T>(url: string, body?: any, options: UseFetchOptions<T> = {}) => {
    return request<T>(url, { ...options, method: 'PUT', body })
  }

  const del = <T>(url: string, options: UseFetchOptions<T> = {}) => {
    return request<T>(url, { ...options, method: 'DELETE' })
  }

  const patch = <T>(url: string, body?: any, options: UseFetchOptions<T> = {}) => {
    return request<T>(url, { ...options, method: 'PATCH', body })
  }

  return {
    request,
    get,
    post,
    put,
    del,
    patch,
    apiBase,
  }
}
