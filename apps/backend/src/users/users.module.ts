import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { SocialAccount } from '../entities/social-account.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, SocialAccount])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
