import { Module } from '@nestjs/common';
import { DummySmsService } from './dummy-sms.service';

@Module({
  providers: [
    {
      provide: 'SmsServiceInterface',
      useClass: DummySmsService,
    },
  ],
  exports: ['SmsServiceInterface'],
})
export class SmsModule {}
