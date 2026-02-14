import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    CacheModule.register(),
  ],
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
