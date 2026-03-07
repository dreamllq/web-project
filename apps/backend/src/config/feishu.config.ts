export interface FeishuConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export const feishuConfig = (): FeishuConfig => ({
  appId: process.env.FEISHU_APP_ID || '',
  appSecret: process.env.FEISHU_APP_SECRET || '',
  redirectUri:
    process.env.FEISHU_REDIRECT_URI || 'http://localhost:3001/api/auth/oauth/feishu/callback',
});

export default feishuConfig;
