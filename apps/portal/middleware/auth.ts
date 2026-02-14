/**
 * Auth Middleware
 * Protects routes that require authentication
 * 
 * Usage in pages:
 * ```vue
 * <script setup>
 * definePageMeta({
 *   middleware: 'auth'
 * })
 * </script>
 * ```
 */

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  // Public routes that don't require authentication
  const publicRoutes = ['/login', '/register', '/auth/callback', '/forgot-password', '/']

  // Check if the route is public
  if (publicRoutes.includes(to.path)) {
    return
  }

  // Check if user is authenticated
  if (!authStore.isAuthenticated) {
    // Redirect to login with the intended destination
    return navigateTo({
      path: '/login',
      query: {
        redirect: to.fullPath,
      },
    })
  }
})
