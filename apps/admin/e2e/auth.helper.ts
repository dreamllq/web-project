import { Page, expect } from '@playwright/test';

/**
 * Authentication Helper for E2E Tests
 *
 * Provides reusable authentication functions for Playwright tests
 */

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123!';

/**
 * Login as admin user
 * @param page Playwright page object
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/login`);

  // Wait for login form to be visible
  await expect(page.locator('.login-card')).toBeVisible();

  // Fill login form
  await page.locator('input[placeholder*="username"]').fill(ADMIN_USERNAME);
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD);

  // Submit login
  await page.locator('.login-btn').click();

  // Wait for redirect to admin dashboard
  await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
}

/**
 * Logout current user
 * @param page Playwright page object
 */
export async function logout(page: Page): Promise<void> {
  // Click on user menu (avatar or username)
  const userMenu = page.locator('.user-dropdown, .el-dropdown-link, [class*="avatar"]').first();
  await userMenu.click();

  // Click logout button
  await page.locator('text=/Logout|退出/').click();

  // Wait for redirect to login
  await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
}

/**
 * Navigate to a specific admin page
 * @param page Playwright page object
 * @param path Path to navigate to (e.g., 'users', 'policies')
 */
export async function navigateToAdminPage(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE_URL}/admin/${path}`);

  // Wait for page to load
  await expect(page).toHaveURL(new RegExp(`/admin/${path}`), { timeout: 5000 });
}

/**
 * Check if user is authenticated
 * @param page Playwright page object
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    await page.goto(`${BASE_URL}/admin`);
    await page.waitForURL(/\/admin/, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get authentication tokens from localStorage
 * @param page Playwright page object
 */
export async function getAuthTokens(
  page: Page
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const tokens = await page.evaluate(() => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  });
  return tokens;
}

/**
 * Set authentication tokens in localStorage (for bypassing login in tests)
 * @param page Playwright page object
 * @param accessToken Access token
 * @param refreshToken Refresh token
 */
export async function setAuthTokens(
  page: Page,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await page.evaluate(
    (tokens) => {
      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);
    },
    { accessToken, refreshToken }
  );
}

/**
 * Clear authentication tokens from localStorage
 * @param page Playwright page object
 */
export async function clearAuthTokens(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  });
}

/**
 * Wait for API response
 * @param page Playwright page object
 * @param urlPattern URL pattern to wait for
 */
export async function waitForApiResponse(page: Page, urlPattern: string | RegExp): Promise<void> {
  await page.waitForResponse((response) =>
    typeof urlPattern === 'string'
      ? response.url().includes(urlPattern)
      : urlPattern.test(response.url())
  );
}

/**
 * Test credentials from environment
 */
export const testCredentials = {
  admin: {
    username: ADMIN_USERNAME,
    password: ADMIN_PASSWORD,
  },
  // Add more test users as needed
};
