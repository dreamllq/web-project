import { SetMetadata } from '@nestjs/common';

export const SUBJECT_TYPE_KEY = 'subject_type';

export interface SubjectTypeConfig {
  /**
   * The subject type identifier
   * - 'role': Role-based subject
   * - 'user': User-based subject
   * - 'department': Department-based subject
   * - 'all': All entities (wildcard)
   */
  type: 'role' | 'user' | 'department' | 'all';

  /**
   * Display label for the subject type (e.g., '角色', '用户', '部门')
   */
  label: string;
}

/**
 * RegisterSubjectType Decorator
 *
 * Marks a service class as a provider of subject values for a specific subject type.
 * This decorator is used by the policy system to discover services that can provide
 * available values for each subject type (e.g., list of roles, list of users).
 *
 * @param config - The subject type configuration containing type and label
 *
 * @example
 * @RegisterSubjectType({ type: 'role', label: '角色' })
 * @Injectable()
 * export class RoleSubjectService implements SubjectValueProvider {
 *   async getValues(): Promise<SubjectValue[]> {
 *     // Return list of available roles
 *   }
 * }
 *
 * @example
 * @RegisterSubjectType({ type: 'user', label: '用户' })
 * @Injectable()
 * export class UserSubjectService implements SubjectValueProvider {
 *   async getValues(): Promise<SubjectValue[]> {
 *     // Return list of available users
 *   }
 * }
 */
export const RegisterSubjectType = (config: SubjectTypeConfig) =>
  SetMetadata(SUBJECT_TYPE_KEY, config);
