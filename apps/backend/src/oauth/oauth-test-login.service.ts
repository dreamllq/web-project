import { Injectable, NotFoundException } from '@nestjs/common';
import { forwardRef, Inject } from '@nestjs/common';
import { OAuthProviderCode } from '../entities/oauth-provider-config.entity';
import { OAuthProviderService } from './oauth-provider.service';
import { WechatOAuthService } from '../auth/oauth/wechat.service';
import { WechatMiniprogramService } from '../auth/oauth/wechat-miniprogram.service';
import { DingtalkMiniprogramService } from '../auth/oauth/dingtalk-miniprogram.service';
import { FeishuOAuthService } from '../auth/oauth/feishu.service';
import { DouyinOAuthService } from '../auth/oauth/douyin.service';
import { QQOAuthService } from '../auth/oauth/qq.service';
import { BaiduOAuthService } from '../auth/oauth/baidu.service';
import { TestLoginResponse, TestLoginUrlResponse } from './dto/oauth-admin.dto';

export interface OAuthTestService {
  getAuthorizationUrl(state?: string, configId?: string): Promise<{ url: string }>;
  handleTestCallback(
    code: string,
    configId?: string
  ): Promise<{
    providerUserId: string;
    nickname: string | null;
    avatarUrl: string | null;
    rawUserInfo: Record<string, unknown>;
  }>;
}

@Injectable()
export class OAuthTestLoginService {
  constructor(
    private readonly oauthProviderService: OAuthProviderService,
    @Inject(forwardRef(() => WechatOAuthService))
    private readonly wechatOAuthService: WechatOAuthService,
    @Inject(forwardRef(() => WechatMiniprogramService))
    private readonly wechatMiniprogramService: WechatMiniprogramService,
    @Inject(forwardRef(() => DingtalkMiniprogramService))
    private readonly dingtalkMiniprogramService: DingtalkMiniprogramService,
    @Inject(forwardRef(() => FeishuOAuthService))
    private readonly feishuOAuthService: FeishuOAuthService,
    @Inject(forwardRef(() => DouyinOAuthService))
    private readonly douyinOAuthService: DouyinOAuthService,
    @Inject(forwardRef(() => QQOAuthService))
    private readonly qqOAuthService: QQOAuthService,
    @Inject(forwardRef(() => BaiduOAuthService))
    private readonly baiduOAuthService: BaiduOAuthService
  ) {}

  async getTestLoginUrl(configId: string): Promise<TestLoginUrlResponse> {
    const config = await this.oauthProviderService.getByConfigId(configId);
    if (!config) {
      throw new NotFoundException('OAuth provider configuration not found');
    }

    if (!config.enabled) {
      throw new NotFoundException('OAuth provider configuration is disabled');
    }

    const state = `test_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const service = this.getOAuthService(config.code);
    const response = await service.getAuthorizationUrl(state, configId);

    return {
      url: response.url,
      configId,
      provider: config.code,
    };
  }

  async handleTestCallback(configId: string, code: string): Promise<TestLoginResponse> {
    const config = await this.oauthProviderService.getByConfigId(configId);
    if (!config) {
      throw new NotFoundException('OAuth provider configuration not found');
    }

    if (!config.enabled) {
      throw new NotFoundException('OAuth provider configuration is disabled');
    }

    const service = this.getOAuthService(config.code);
    const result = await service.handleTestCallback(code, configId);

    return {
      providerUserId: result.providerUserId,
      nickname: result.nickname,
      avatarUrl: result.avatarUrl,
      provider: config.code,
      rawUserInfo: result.rawUserInfo,
    };
  }

  private getOAuthService(code: OAuthProviderCode): OAuthTestService {
    switch (code) {
      case OAuthProviderCode.WECHAT:
        return this.wechatOAuthService as OAuthTestService;
      case OAuthProviderCode.WECHAT_MINIPROGRAM:
        return this.wechatMiniprogramService as OAuthTestService;
      case OAuthProviderCode.DINGTALK_MINIPROGRAM:
        return this.dingtalkMiniprogramService as OAuthTestService;
      case OAuthProviderCode.DINGTALK:
        throw new NotFoundException('DingTalk OAuth service is not implemented yet');
      case OAuthProviderCode.FEISHU:
        return this.feishuOAuthService as OAuthTestService;
      case OAuthProviderCode.DOUYIN:
        return this.douyinOAuthService as OAuthTestService;
      case OAuthProviderCode.QQ:
        return this.qqOAuthService as OAuthTestService;
      case OAuthProviderCode.BAIDU:
        return this.baiduOAuthService as OAuthTestService;
      default:
        throw new NotFoundException(`Unknown OAuth provider: ${code}`);
    }
  }
}
