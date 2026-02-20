/**
 * Audit log type definitions
 */

export interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string;
  userAgent: string | null;
  requestData: Record<string, unknown> | null;
  responseStatus: number;
  errorMessage: string | null;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    nickname?: string;
  } | null;
}

export interface QueryAuditLogParams {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogListResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Format action type for display
 */
export function formatAction(action: string): string {
  const actionMap: Record<string, string> = {
    'user.create': 'Create User',
    'user.update': 'Update User',
    'user.delete': 'Delete User',
    'user.login': 'Login',
    'user.logout': 'Logout',
    'policy.create': 'Create Policy',
    'policy.update': 'Update Policy',
    'policy.delete': 'Delete Policy',
    'role.create': 'Create Role',
    'role.update': 'Update Role',
    'role.delete': 'Delete Role',
  };
  return actionMap[action] || action;
}

/**
 * Get action tag type for display
 */
export function getActionType(action: string): 'success' | 'warning' | 'danger' | 'info' {
  if (action.includes('.create')) return 'success';
  if (action.includes('.update')) return 'warning';
  if (action.includes('.delete')) return 'danger';
  return 'info';
}
