/**
 * DingTalk miniprogram configuration
 */
export interface DingtalkMiniprogramConfig {
  appKey: string;
  appSecret: string;
}

export const dingtalkMiniprogramConfig = (): DingtalkMiniprogramConfig => ({
  appKey: process.env.DINGTALK_MINIPROGRAM_APP_KEY || '',
  appSecret: process.env.DINGTALK_MINIPROGRAM_APP_SECRET || '',
});

export default dingtalkMiniprogramConfig;
