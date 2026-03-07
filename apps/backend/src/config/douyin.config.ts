export interface DouyinConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export const douyinConfig = (): DouyinConfig => ({
  appId: process.env.DOUYIN_APP_ID || '',
  appSecret: process.env.DOUYIN_APP_SECRET || '',
  redirectUri:
    process.env.DOUYIN_REDIRECT_URI || 'https://localhost:3001/api/auth/oauth/douyin/callback',
});

export default douyinConfig;
