import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomCacheModule } from '../custom-cache/custom-cache.module';
import { OAuthClient } from '../entities/oauth-client.entity';
import { OAuthToken } from '../entities/oauth-token.entity';
import { OAuthProviderConfig } from '../entities/oauth-provider-config.entity';
import { OAuthController } from './oauth.controller';
import { OAuthAdminController } from './oauth-admin.controller';
import { OAuthService } from './oauth.service';
import { OAuthProviderService } from './oauth-provider.service';
import { OAuthClientService } from './oauth-client.service';
import { OAuthTokenService } from './oauth-token.service';
import { UsersModule } from '../users/users.module';
import { OAuthSecretEncryptionService } from './oauth-secret-encryption.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([OAuthClient, OAuthToken, OAuthProviderConfig]),
    UsersModule,
    CustomCacheModule,
  ],
  controllers: [OAuthController, OAuthAdminController],
  providers: [
    OAuthService,
    OAuthProviderService,
    OAuthClientService,
    OAuthTokenService,
    OAuthSecretEncryptionService,
  ],
  exports: [
    OAuthService,
    OAuthProviderService,
    OAuthClientService,
    OAuthTokenService,
    OAuthSecretEncryptionService,
  ],
})
export class OAuthModule {}
