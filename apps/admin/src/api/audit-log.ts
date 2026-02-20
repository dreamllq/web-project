import api from './index';
import type { AuditLogListResponse, QueryAuditLogParams, AuditLog } from '@/types/audit-log';

/**
 * Get audit logs with optional filtering and pagination
 */
export async function getAuditLogs(params: QueryAuditLogParams): Promise<AuditLogListResponse> {
  const response = await api.get<AuditLogListResponse>('/audit-logs', { params });
  return response.data;
}

/**
 * Get a specific audit log by ID
 */
export async function getAuditLog(id: string): Promise<AuditLog> {
  const response = await api.get<AuditLog>(`/audit-logs/${id}`);
  return response.data;
}

/**
 * Get audit logs for a specific user
 */
export async function getAuditLogsByUser(
  userId: string,
  limit = 20,
  page = 1
): Promise<AuditLogListResponse> {
  return getAuditLogs({ userId, limit, page });
}

/**
 * Get audit logs for a specific resource
 */
export async function getAuditLogsByResource(
  resourceType: string,
  resourceId: string,
  limit = 20,
  page = 1
): Promise<AuditLogListResponse> {
  return getAuditLogs({ resourceType, resourceId, limit, page });
}
