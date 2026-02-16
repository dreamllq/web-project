import { Module } from '@nestjs/common';
import { CustomCacheModule } from '../custom-cache/custom-cache.module';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule, CustomCacheModule],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
