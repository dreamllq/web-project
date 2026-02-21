import api from './index';
import type { CoverageResponse, TestPermissionDto, TestPermissionResult } from '@/types/abac';

// ============================================
// ABAC Coverage API
// ============================================

/**
 * Get ABAC coverage statistics
 * GET /api/abac/coverage
 */
export function getCoverage(): Promise<{ data: CoverageResponse }> {
  return api.get('/abac/coverage');
}

// ============================================
// ABAC Test Permission API
// ============================================

/**
 * Test permission for a specific user, resource and action
 * POST /api/v1/abac/test
 */
export function testPermission(data: TestPermissionDto): Promise<{ data: TestPermissionResult }> {
  return api.post('/v1/abac/test', data);
}

/**
 * ABAC API object with all methods
 */
export const abacApi = {
  getCoverage,
  testPermission,
};
