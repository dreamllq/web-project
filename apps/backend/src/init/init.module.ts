import { Module, forwardRef } from '@nestjs/common';
import { InitService } from './init.service';
import { UsersModule } from '../users/users.module';
import { PolicyModule } from '../policy/policy.module';

@Module({
  imports: [forwardRef(() => UsersModule), forwardRef(() => PolicyModule)],
  controllers: [],
  providers: [InitService],
  exports: [InitService],
})
export class InitModule {}
