import { defineStore } from 'pinia'

export interface User {
  id: string
  username: string
  email?: string
  phone?: string
  avatar?: string
  status: string
  createdAt: string
}

export const useAuthStore = defineStore('auth', () => {
  // Use cookies for persistence (SSR-friendly)
  const tokenCookie = useCookie('access_token', {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'lax',
  })

  const refreshTokenCookie = useCookie('refresh_token', {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
    sameSite: 'lax',
  })

  const userCookie = useCookie<User | null>('auth_user', {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'lax',
  })

  // Reactive state
  const user = ref<User | null>(userCookie.value || null)
  const token = ref<string | null>(tokenCookie.value || null)
  const refreshToken = ref<string | null>(refreshTokenCookie.value || null)

  // Computed
  const isAuthenticated = computed(() => !!token.value)
  const isLoggedIn = computed(() => isAuthenticated.value && !!token.value)

  // Actions
  const setAuth = (data: { user: User; token: string; refreshToken: string }) => {
    user.value = data.user
    token.value = data.token
    refreshToken.value = data.refreshToken

    // Persist to cookies
    tokenCookie.value = data.token
    refreshTokenCookie.value = data.refreshToken
    userCookie.value = data.user
  }

  const setToken = (newToken: string, newRefreshToken: string) => {
    token.value = newToken
    refreshToken.value = newRefreshToken

    tokenCookie.value = newToken
    refreshTokenCookie.value = newRefreshToken
  }

  const setUser = (userData: User) => {
    user.value = userData
    userCookie.value = userData
  }

  const clearAuth = () => {
    user.value = null
    token.value = null
    refreshToken.value = null

    tokenCookie.value = null
    refreshTokenCookie.value = null
    userCookie.value = null
  }

  const initAuth = () => {
    // Cookies are automatically loaded via useCookie
    // Just sync local state with cookie values
    if (tokenCookie.value && userCookie.value) {
      token.value = tokenCookie.value
      refreshToken.value = refreshTokenCookie.value || null
      user.value = userCookie.value
    }
  }

  const hasValidToken = (): boolean => {
    return !!token.value && token.value.length > 0
  }

  // Initialize on store creation
  initAuth()

  return {
    user,
    token,
    refreshToken,
    isAuthenticated,
    isLoggedIn,
    setAuth,
    setToken,
    setUser,
    clearAuth,
    initAuth,
    hasValidToken,
  }
})
