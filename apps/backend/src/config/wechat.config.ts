export interface WeChatConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export const wechatConfig = (): WeChatConfig => ({
  appId: process.env.WECHAT_APP_ID || '',
  appSecret: process.env.WECHAT_APP_SECRET || '',
  redirectUri:
    process.env.WECHAT_REDIRECT_URI ||
    'http://localhost:3001/api/auth/oauth/wechat/callback',
});

export default wechatConfig;
