export interface QQConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
}

export const qqConfig = (): QQConfig => ({
  appId: process.env.QQ_APP_ID || '',
  appSecret: process.env.QQ_APP_SECRET || '',
  redirectUri: process.env.QQ_REDIRECT_URI || 'http://localhost:3001/api/auth/oauth/qq/callback',
});

export default qqConfig;
