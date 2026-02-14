/**
 * WeChat miniprogram configuration
 */
export interface WechatMiniprogramConfig {
  appId: string;
  appSecret: string;
}

export const wechatMiniprogramConfig = (): WechatMiniprogramConfig => ({
  appId: process.env.WECHAT_MINIPROGRAM_APP_ID || '',
  appSecret: process.env.WECHAT_MINIPROGRAM_APP_SECRET || '',
});

export default wechatMiniprogramConfig;
