import { Module } from '@nestjs/common';
import { InitService } from './init.service';

@Module({
  imports: [],
  controllers: [],
  providers: [InitService],
  exports: [InitService],
})
export class InitModule {}
