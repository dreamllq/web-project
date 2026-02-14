import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';
import { CreateAuditLogDto, QueryAuditLogDto } from './dto';

// Sensitive fields that should be redacted from audit logs
const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'secret', 'apiKey', 'authorization'];

/**
 * Sanitizes request data by redacting sensitive fields
 */
export function sanitizeRequestData(data: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    // Check if key matches any sensitive field (case-insensitive)
    const isSensitive = SENSITIVE_FIELDS.some(field =>
      key.toLowerCase().includes(field.toLowerCase())
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      sanitized[key] = sanitizeRequestData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Extracts resource ID from response object
 */
export function extractResourceId(response: unknown): string | undefined {
  if (!response || typeof response !== 'object') {
    return undefined;
  }

  const obj = response as Record<string, unknown>;

  // Try common ID fields
  if (typeof obj.id === 'string') {
    return obj.id;
  }

  // Check nested data object
  if (obj.data && typeof obj.data === 'object') {
    const dataObj = obj.data as Record<string, unknown>;
    if (typeof dataObj.id === 'string') {
      return dataObj.id;
    }
  }

  return undefined;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Create a new audit log entry
   * This method is non-blocking and logs errors without throwing
   */
  async log(data: CreateAuditLogDto): Promise<void> {
    try {
      const auditLog = this.auditLogRepo.create({
        userId: data.userId ?? null,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId ?? null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent ?? null,
        requestData: data.requestData ?? null,
        responseStatus: data.responseStatus,
        errorMessage: data.errorMessage ?? null,
      });

      await this.auditLogRepo.save(auditLog);
      this.logger.debug(
        `Audit log created: ${data.action} on ${data.resourceType} by user ${data.userId ?? 'anonymous'}`
      );
    } catch (error) {
      // Log error but don't throw - audit logging should not break the main flow
      this.logger.error(
        `Failed to create audit log: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Find all audit logs with filtering and pagination
   */
  async findAll(query: QueryAuditLogDto): Promise<{ data: AuditLog[]; total: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<AuditLog> = {};

    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }
    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }

    // Handle date range filtering
    if (query.startDate && query.endDate) {
      where.createdAt = Between(new Date(query.startDate), new Date(query.endDate));
    } else if (query.startDate) {
      where.createdAt = MoreThanOrEqual(new Date(query.startDate));
    } else if (query.endDate) {
      where.createdAt = LessThanOrEqual(new Date(query.endDate));
    }

    const [data, total] = await this.auditLogRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['user'],
    });

    return { data, total };
  }

  /**
   * Find a single audit log by ID
   */
  async findOne(id: string): Promise<AuditLog> {
    const auditLog = await this.auditLogRepo.findOne({
      where: { id },
      relations: ['user'],
    });

    if (!auditLog) {
      throw new NotFoundException(`Audit log with ID "${id}" not found`);
    }

    return auditLog;
  }

  /**
   * Get audit logs for a specific user
   */
  async findByUserId(userId: string, limit = 50): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get audit logs for a specific resource
   */
  async findByResource(resourceType: string, resourceId: string, limit = 50): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { resourceType, resourceId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
