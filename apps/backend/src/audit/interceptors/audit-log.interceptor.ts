import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AuditService, sanitizeRequestData, extractResourceId } from '../audit.service';
import { AUDIT_LOG_KEY, AuditLogMetadata } from '../decorators/audit-log.decorator';

/**
 * AuditLogInterceptor
 *
 * Intercepts requests to methods decorated with @AuditLog and records
 * audit information including user ID, action, resource, IP, time, and result.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Get audit configuration from decorator
    const auditConfig = this.reflector.getAllAndOverride<AuditLogMetadata>(AUDIT_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no @AuditLog decorator, skip logging
    if (!auditConfig) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();

    // Extract request information
    const userId = request.user?.id;
    const ipAddress = this.extractIpAddress(request);
    const userAgent = request.headers['user-agent'] || undefined;
    const requestData = sanitizeRequestData(request.body) ?? undefined;

    return next.handle().pipe(
      tap({
        next: (response) => {
          // Extract resource ID from response if available
          const resourceId = extractResourceId(response);
          const responseStatus = context.switchToHttp().getResponse().statusCode;

          // Log successful operation
          this.auditService.log({
            action: auditConfig.action,
            resourceType: auditConfig.resourceType,
            userId,
            resourceId,
            ipAddress,
            userAgent,
            requestData,
            responseStatus,
          }).catch(error => {
            this.logger.error(`Failed to log audit: ${error instanceof Error ? error.message : 'Unknown error'}`);
          });
        },
        error: (error) => {
          // Log failed operation
          this.auditService.log({
            action: auditConfig.action,
            resourceType: auditConfig.resourceType,
            userId,
            ipAddress,
            userAgent,
            requestData,
            responseStatus: error.status || 500,
            errorMessage: error.message,
          }).catch(logError => {
            this.logger.error(`Failed to log audit error: ${logError instanceof Error ? logError.message : 'Unknown error'}`);
          });
        },
      }),
    );
  }

  /**
   * Extract client IP address from request
   * Handles proxy headers like X-Forwarded-For
   */
  private extractIpAddress(request: any): string {
    // Check for proxy headers first
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      // X-Forwarded-For can contain multiple IPs, take the first one
      const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
      return ips.split(',')[0].trim();
    }

    // Check X-Real-IP header (common with nginx)
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    // Fall back to connection remote address
    return request.ip || request.connection?.remoteAddress || 'unknown';
  }
}
