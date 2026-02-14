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

export interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
  }),

  getters: {
    getUser: (state) => state.user,
    getToken: (state) => state.token,
    getRefreshToken: (state) => state.refreshToken,
    isLoggedIn: (state) => state.isAuthenticated && !!state.token,
  },

  actions: {
    setAuth(data: { user: User; token: string; refreshToken: string }) {
      this.user = data.user
      this.token = data.token
      this.refreshToken = data.refreshToken
      this.isAuthenticated = true

      // Persist to localStorage (client-side only)
      if (import.meta.client) {
        localStorage.setItem('auth_token', data.token)
        localStorage.setItem('auth_refresh_token', data.refreshToken)
        localStorage.setItem('auth_user', JSON.stringify(data.user))
      }
    },

    setToken(token: string, refreshToken: string) {
      this.token = token
      this.refreshToken = refreshToken

      if (import.meta.client) {
        localStorage.setItem('auth_token', token)
        localStorage.setItem('auth_refresh_token', refreshToken)
      }
    },

    setUser(user: User) {
      this.user = user

      if (import.meta.client) {
        localStorage.setItem('auth_user', JSON.stringify(user))
      }
    },

    clearAuth() {
      this.user = null
      this.token = null
      this.refreshToken = null
      this.isAuthenticated = false

      if (import.meta.client) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_refresh_token')
        localStorage.removeItem('auth_user')
      }
    },

    // Initialize auth state from localStorage
    initAuth() {
      if (import.meta.client) {
        const token = localStorage.getItem('auth_token')
        const refreshToken = localStorage.getItem('auth_refresh_token')
        const userStr = localStorage.getItem('auth_user')

        if (token && userStr) {
          try {
            const user = JSON.parse(userStr) as User
            this.token = token
            this.refreshToken = refreshToken
            this.user = user
            this.isAuthenticated = true
          } catch (e) {
            this.clearAuth()
          }
        }
      }
    },

    // Check if token is valid (basic check)
    hasValidToken(): boolean {
      return !!this.token && this.token.length > 0
    },
  },
})
