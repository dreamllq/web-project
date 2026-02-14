import ElementPlus from 'element-plus'
import type { DefineComponent } from 'vue'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(ElementPlus)
})

// Declare Element Plus components for auto-import
declare module '@vue/runtime-core' {
  export interface GlobalComponents {
    ElButton: DefineComponent<{}, {}, any>
    ElInput: DefineComponent<{}, {}, any>
    ElForm: DefineComponent<{}, {}, any>
    ElFormItem: DefineComponent<{}, {}, any>
    ElCard: DefineComponent<{}, {}, any>
    ElContainer: DefineComponent<{}, {}, any>
    ElHeader: DefineComponent<{}, {}, any>
    ElMain: DefineComponent<{}, {}, any>
    ElFooter: DefineComponent<{}, {}, any>
    ElMenu: DefineComponent<{}, {}, any>
    ElMenuItem: DefineComponent<{}, {}, any>
    ElDropdown: DefineComponent<{}, {}, any>
    ElDropdownMenu: DefineComponent<{}, {}, any>
    ElDropdownItem: DefineComponent<{}, {}, any>
    ElAvatar: DefineComponent<{}, {}, any>
    ElIcon: DefineComponent<{}, {}, any>
    ElMessage: DefineComponent<{}, {}, any>
    ElNotification: DefineComponent<{}, {}, any>
    ElDialog: DefineComponent<{}, {}, any>
    ElLoading: DefineComponent<{}, {}, any>
    ElSelect: DefineComponent<{}, {}, any>
    ElOption: DefineComponent<{}, {}, any>
    ElSwitch: DefineComponent<{}, {}, any>
    ElCheckbox: DefineComponent<{}, {}, any>
    ElRadio: DefineComponent<{}, {}, any>
    ElRadioGroup: DefineComponent<{}, {}, any>
    ElTabs: DefineComponent<{}, {}, any>
    ElTabPane: DefineComponent<{}, {}, any>
    ElBreadcrumb: DefineComponent<{}, {}, any>
    ElBreadcrumbItem: DefineComponent<{}, {}, any>
    ElTag: DefineComponent<{}, {}, any>
    ElBadge: DefineComponent<{}, {}, any>
    ElAlert: DefineComponent<{}, {}, any>
    ElTooltip: DefineComponent<{}, {}, any>
    ElPopover: DefineComponent<{}, {}, any>
    ElDivider: DefineComponent<{}, {}, any>
    ElRow: DefineComponent<{}, {}, any>
    ElCol: DefineComponent<{}, {}, any>
    ElSpace: DefineComponent<{}, {}, any>
    ElLink: DefineComponent<{}, {}, any>
    ElText: DefineComponent<{}, {}, any>
  }
}
