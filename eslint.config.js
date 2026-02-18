import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],
  prettier,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.nuxt/**',
      '.output/**',
      '**/*.spec.ts',
      '**/*.test.ts',
      '**/env.d.ts',
      '**/.nuxt/**',
      '**/.output/**',
      '**/types/*.d.ts',
      '**/imports.d.ts',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/triple-slash-reference': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ref: 'readonly',
        reactive: 'readonly',
        computed: 'readonly',
        watch: 'readonly',
        watchEffect: 'readonly',
        onMounted: 'readonly',
        onUnmounted: 'readonly',
        onBeforeMount: 'readonly',
        onBeforeUnmount: 'readonly',
        nextTick: 'readonly',
        provide: 'readonly',
        inject: 'readonly',
        toRef: 'readonly',
        toRefs: 'readonly',
        unref: 'readonly',
        isRef: 'readonly',
        shallowRef: 'readonly',
        shallowReactive: 'readonly',
        defineComponent: 'readonly',
        defineEmits: 'readonly',
        defineProps: 'readonly',
        defineExpose: 'readonly',
        withDefaults: 'readonly',
        useRoute: 'readonly',
        useRouter: 'readonly',
        useState: 'readonly',
        useFetch: 'readonly',
        useAsyncData: 'readonly',
        useHead: 'readonly',
        navigateTo: 'readonly',
        useCookie: 'readonly',
        useRuntimeConfig: 'readonly',
        useRequestURL: 'readonly',
        useRequestEvent: 'readonly',
        useAppConfig: 'readonly',
        definePageMeta: 'readonly',
        defineNuxtConfig: 'readonly',
        useNuxtApp: 'readonly',
        useApi: 'readonly',
        useAuth: 'readonly',
        ElMessage: 'readonly',
        ElMessageBox: 'readonly',
        ElNotification: 'readonly',
        FileReader: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'vue/multi-word-component-names': 'off',
    },
  }
);
