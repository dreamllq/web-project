import { Injectable, Logger, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { Brackets } from 'typeorm';
import { PolicyEvaluatorService } from '../policy-evaluator.service';
import {
  APPLY_DATA_FILTER_KEY,
  ApplyDataFilterMetadata,
} from '../decorators/apply-data-filter.decorator';
import { User } from '../../entities/user.entity';

/**
 * Extended Request interface with data filter conditions
 */
export interface RequestWithDataFilter extends Request {
  user?: User;
  dataFilterConditions?: Brackets[];
}

/**
 * DataFilterInterceptor
 *
 * Intercepts requests marked with @ApplyDataFilter decorator and injects
 * ABAC data filter conditions into the request context.
 *
 * The interceptor does NOT execute queries - it only prepares the filter
 * conditions. Services should read request.dataFilterConditions and apply
 * them to their TypeORM queries.
 *
 * Flow:
 * 1. Read @ApplyDataFilter metadata from handler
 * 2. Extract user from request (set by JwtAuthGuard)
 * 3. Call PolicyEvaluatorService.getDataFilterConditions()
 * 4. Store conditions in request.dataFilterConditions
 *
 * @example
 * // In controller:
 * @Get()
 * @ApplyDataFilter(Policy)
 * findAll(@Req() req: RequestWithDataFilter) {
 *   // req.dataFilterConditions contains Brackets[] for filtering
 * }
 *
 * // In service:
 * async findAll(req: RequestWithDataFilter) {
 *   const qb = this.repository.createQueryBuilder('policy');
 *   if (req.dataFilterConditions) {
 *     for (const bracket of req.dataFilterConditions) {
 *       qb.andWhere(bracket);
 *     }
 *   }
 *   return qb.getMany();
 * }
 */
@Injectable()
export class DataFilterInterceptor implements NestInterceptor {
  private readonly logger = new Logger(DataFilterInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly policyEvaluator: PolicyEvaluatorService
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const requestStartTime = Date.now();

    // Get metadata from handler
    const metadata = this.reflector.get<ApplyDataFilterMetadata>(
      APPLY_DATA_FILTER_KEY,
      context.getHandler()
    );

    // If no @ApplyDataFilter decorator, skip processing
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithDataFilter>();
    const user = request.user;

    // If no authenticated user, skip (Guard should handle auth)
    if (!user) {
      this.logger.debug({
        message: 'DataFilterInterceptor: No authenticated user, skipping data filter',
        hasMetadata: true,
        entity: metadata.entity.name,
      });
      return next.handle();
    }

    // Resolve resource and action from metadata or defaults
    const resource = metadata.resource ?? metadata.entity.name.toLowerCase();
    const action = metadata.action ?? 'read';
    const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    this.logger.debug({
      message: 'DataFilterInterceptor: Starting request processing',
      requestId,
      userId: user.id,
      username: user.username,
      entity: metadata.entity.name,
      resource,
      action,
    });

    try {
      // Get filter conditions from PolicyEvaluatorService
      const dataFilterConditions = await this.policyEvaluator.getDataFilterConditions(
        user,
        resource,
        action
      );

      // Store conditions in request for services to use
      request.dataFilterConditions = dataFilterConditions;

      this.logger.debug({
        message: 'DataFilterInterceptor: Request processing complete',
        requestId,
        userId: user.id,
        resource,
        action,
        conditionsCount: dataFilterConditions.length,
        processingTimeMs: Date.now() - requestStartTime,
      });
    } catch (error) {
      // Log error but don't block request - fail open for read operations
      this.logger.error({
        message: 'DataFilterInterceptor: Failed to get data filter conditions',
        requestId,
        userId: user.id,
        resource,
        action,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: Date.now() - requestStartTime,
      });

      // Set empty conditions to allow request to proceed
      request.dataFilterConditions = [];
    }

    return next.handle();
}

}