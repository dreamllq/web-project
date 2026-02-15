/**
 * Validation functions for CLI prompts
 */

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Password validation rules:
 * - Minimum 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || password.length === 0) {
    return { valid: false, message: '密码不能为空' };
  }

  if (password.length < 8) {
    return { valid: false, message: '密码至少需要 8 个字符' };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个大写字母' };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个小写字母' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个数字' };
  }

  return { valid: true };
}

/**
 * Username validation rules:
 * - Minimum 3 characters
 * - Maximum 32 characters
 * - Only alphanumeric characters and underscores
 * - Cannot start with a number
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || username.length === 0) {
    return { valid: false, message: '用户名不能为空' };
  }

  if (username.length < 3) {
    return { valid: false, message: '用户名至少需要 3 个字符' };
  }

  if (username.length > 32) {
    return { valid: false, message: '用户名不能超过 32 个字符' };
  }

  // Only alphanumeric and underscore
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(username)) {
    return { valid: false, message: '用户名只能包含字母、数字和下划线，且必须以字母或下划线开头' };
  }

  return { valid: true };
}

/**
 * Database URL validation for remote databases
 */
export function validateDatabaseUrl(url: string): ValidationResult {
  if (!url || url.length === 0) {
    return { valid: false, message: '数据库 URL 不能为空' };
  }

  // Check for valid PostgreSQL URL format
  if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
    return { valid: false, message: '数据库 URL 必须以 postgresql:// 或 postgres:// 开头' };
  }

  return { valid: true };
}

/**
 * Redis host validation
 */
export function validateRedisHost(host: string): ValidationResult {
  if (!host || host.length === 0) {
    return { valid: false, message: 'Redis 主机地址不能为空' };
  }

  return { valid: true };
}

/**
 * Port validation
 */
export function validatePort(port: string): ValidationResult {
  if (!port || port.length === 0) {
    return { valid: false, message: '端口不能为空' };
  }

  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, message: '端口号必须是 1-65535 之间的数字' };
  }

  return { valid: true };
}

/**
 * Validate password confirmation matches
 */
export function validatePasswordConfirmation(
  password: string,
  confirmation: string
): ValidationResult {
  if (password !== confirmation) {
    return { valid: false, message: '两次输入的密码不一致' };
  }

  return { valid: true };
}
