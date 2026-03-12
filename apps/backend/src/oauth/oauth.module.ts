import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomCacheModule } from '../custom-cache/custom-cache.module';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthToken } from '../entities/oauth-token.entity';
import { OAuthProviderConfig } from '../entities/oauth-provider-config.entity';
import { OAuthController } from './oauth.controller';
import { OAuthClientController } from './oauth-client.controller';
import { OAuthProviderController } from './oauth-provider.controller';
import { OAuthTokenController } from './oauth-token.controller';
import { OAuthService } from './oauth.service';
import { OAuthProviderService } from './oauth-provider.service';
import { OAuthClientService } from './oauth-client.service';
import { OAuthTokenService } from './oauth-token.service';
import { OAuthTestLoginService } from './oauth-test-login.service';
import { UsersModule } from '../users/users.module';
import { OAuthSecretEncryptionService } from './oauth-secret-encryption.service';
import { PolicyModule } from '../policy/policy.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OAuthClient, OAuthToken, OAuthProviderConfig]),
    UsersModule,
    CustomCacheModule,
    PolicyModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [
    OAuthController,
    OAuthClientController,
    OAuthProviderController,
    OAuthTokenController,
  ],
  providers: [
    OAuthService,
    OAuthProviderService,
    OAuthClientService,
    OAuthTokenService,
    OAuthSecretEncryptionService,
    OAuthTestLoginService,
  ],
  exports: [
    OAuthService,
    OAuthProviderService,
    OAuthClientService,
    OAuthTokenService,
    OAuthSecretEncryptionService,
    OAuthTestLoginService,
  ],
})
export class OAuthModule {}
