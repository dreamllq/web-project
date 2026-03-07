export interface BaiduConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export const baiduConfig = (): BaiduConfig => ({
  appId: process.env.BAIDU_APP_ID || '',
  appSecret: process.env.BAIDU_APP_SECRET || '',
  redirectUri:
    process.env.BAIDU_REDIRECT_URI || 'http://localhost:3001/api/auth/oauth/baidu/callback',
});

export default baiduConfig;
