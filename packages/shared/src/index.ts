// Shared locales
import zhCN from '../locales/zh-CN.json';
import enUS from '../locales/en-US.json';

export const locales = {
  'zh-CN': zhCN,
  'en-US': enUS,
} as const;

export type LocaleKey = keyof typeof locales;
export type LocaleData = typeof zhCN;

export { zhCN, enUS };
