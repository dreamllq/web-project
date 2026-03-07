/**
 * Social OAuth Provider Types
 */
export enum SocialProvider {
  WECHAT = 'wechat',
  WECHAT_MINIPROGRAM = 'wechat_miniprogram',
  DINGTALK_MINIPROGRAM = 'dingtalk_miniprogram',
  DINGTALK = 'dingtalk',
  FEISHU = 'feishu',
  QQ = 'qq',
  DOUYIN = 'douyin',
  BAIDU = 'baidu',
}

/**
 * Social Account Status
 */
export enum SocialAccountStatus {
  LINKED = 'linked',
  UNLINKED = 'unlinked',
}
