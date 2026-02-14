import { createI18n } from 'vue-i18n'
import zhCN from '~/locales/zh-CN.json'
import enUS from '~/locales/en-US.json'

export default defineNuxtPlugin((nuxtApp) => {
  const i18n = createI18n({
    legacy: false, // Use Composition API mode
    locale: 'zh-CN', // Default locale
    fallbackLocale: 'en-US',
    messages: {
      'zh-CN': zhCN,
      'en-US': enUS,
    },
  })

  nuxtApp.vueApp.use(i18n)

  return {
    provide: {
      i18n,
    },
  }
})

// Export for use in composables
export type I18nInstance = ReturnType<typeof createI18n>
