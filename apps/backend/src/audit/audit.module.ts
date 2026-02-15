import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLogInterceptor } from './interceptors/audit-log.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PolicyModule } from '@/policy/policy.module';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), PolicyModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
