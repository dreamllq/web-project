/**
 * Policy effect enum - matches backend PolicyEffect
 */
export enum PolicyEffect {
  ALLOW = 'allow',
  DENY = 'deny',
}

// ============================================
// Subject Types
// ============================================

/**
 * Subject type - matches backend subject types
 */
export type SubjectType = 'role' | 'user' | 'department' | 'all';

/**
 * Policy subject definition - matches backend JSONB format
 */
export interface PolicySubject {
  type: SubjectType;
  value: string | string[];
}

// ============================================
// Entity Types
// ============================================

/**
 * Permission entity - matches backend Permission entity
 */
export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
}

/**
 * Role entity - matches backend Role entity
 */
export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSuperAdmin: boolean;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Policy entity - matches backend Policy entity
 */
export interface Policy {
  id: string;
  name: string;
  description: string | null;
  effect: PolicyEffect;
  subject: PolicySubject;
  resource: string;
  action: string;
  conditions: Record<string, unknown> | null;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// DTO Types - Policy
// ============================================

/**
 * DTO for creating a new policy
 */
export interface CreatePolicyDto {
  name: string;
  description?: string;
  effect: PolicyEffect;
  subject: PolicySubject;
  resource: string;
  action: string;
  conditions?: Record<string, unknown>;
  priority?: number;
  enabled?: boolean;
}

/**
 * DTO for updating a policy
 */
export interface UpdatePolicyDto {
  name?: string;
  description?: string | null;
  effect?: PolicyEffect;
  subject?: PolicySubject;
  resource?: string;
  action?: string;
  conditions?: Record<string, unknown> | null;
  priority?: number;
  enabled?: boolean;
}

/**
 * Query parameters for policy list
 */
export interface QueryPolicyDto {
  keyword?: string;
  subject?: string;
  resource?: string;
  enabled?: boolean;
  page?: number;
  limit?: number;
}

// ============================================
// DTO Types - Role
// ============================================

/**
 * DTO for creating a new role
 */
export interface CreateRoleDto {
  name: string;
  description?: string;
  permissionIds?: string[];
}

/**
 * DTO for updating a role
 */
export interface UpdateRoleDto {
  name?: string;
  description?: string | null;
  permissionIds?: string[];
}

// ============================================
// DTO Types - Permission
// ============================================

/**
 * DTO for creating a new permission
 */
export interface CreatePermissionDto {
  name: string;
  resource: string;
  action: string;
  description?: string;
}

// ============================================
// DTO Types - User Role Assignment
// ============================================

/**
 * DTO for assigning role to user
 */
export interface AssignRoleDto {
  roleId: string;
}

// ============================================
// API Response Types
// ============================================

/**
 * Paginated policy list response
 */
export interface PolicyListResponse {
  data: Policy[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Role list response
 */
export interface RoleListResponse {
  data: Role[];
}

/**
 * Permission list response
 */
export interface PermissionListResponse {
  data: Permission[];
}

/**
 * Check permission response
 */
export interface CheckPermissionResponse {
  allowed: boolean;
  resource: string;
  action: string;
}

/**
 * User roles response
 */
export interface UserRoleResponse {
  userId: string;
  roles: Role[];
}

/**
 * User permissions response (permission strings)
 */
export interface UserPermissionsResponse {
  permissions: string[];
}

// ============================================
// Policy Subject API Response Types
// ============================================

/**
 * Subject types response - for subject type dropdown
 */
export interface SubjectTypeResponse {
  types: Array<{ type: string; label: string }>;
}

/**
 * Subject values response - for subject value dropdown (roles, users, etc.)
 */
export interface SubjectValueResponse {
  values: Array<{ id: string; label: string }>;
}

/**
 * Resources response - for resource dropdown
 */
export interface ResourcesResponse {
  resources: string[];
}

/**
 * Actions response - for action dropdown
 */
export interface ActionsResponse {
  actions: string[];
}