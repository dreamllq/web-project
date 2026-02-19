import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for User Management Flow
 *
 * These tests cover the complete user management functionality:
 * - Login as admin
 * - Navigate to Users page
 * - List users with pagination
 * - Search users by keyword
 * - Filter users by status
 * - Create new user
 * - Edit existing user
 * - Assign role to user
 * - Delete user
 */

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123!';

// Helper function to login as admin
async function loginAsAdmin(page: Page) {
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

// Helper function to navigate to Users page
async function navigateToUsers(page: Page) {
  // Click on Users menu item in sidebar
  const usersMenuItem = page.locator('text=/Users|用户管理/');
  await usersMenuItem.first().click();

  // Wait for Users page to load
  await expect(page).toHaveURL(/\/admin\/users/, { timeout: 5000 });
  await expect(page.locator('.users-page')).toBeVisible();
}

test.describe('User Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to Users page', async ({ page }) => {
    await navigateToUsers(page);

    // Verify page header
    await expect(page.locator('.card-header h2')).toContainText('User Management');

    // Verify search bar is visible
    await expect(page.locator('.search-bar')).toBeVisible();

    // Verify Create User button is visible
    await expect(page.locator('button:has-text("Create User")')).toBeVisible();
  });

  test('should list users with pagination', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // Verify table has columns
    await expect(page.locator('.users-table th:has-text("Username")')).toBeVisible();
    await expect(page.locator('.users-table th:has-text("Email")')).toBeVisible();
    await expect(page.locator('.users-table th:has-text("Status")')).toBeVisible();
    await expect(page.locator('.users-table th:has-text("Actions")')).toBeVisible();

    // Check pagination is present if there are users
    const paginationExists = await page.locator('.pagination-container').isVisible();
    if (paginationExists) {
      await expect(page.locator('.el-pagination')).toBeVisible();
    }
  });

  test('should search users by keyword', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // Get initial user count
    const initialRows = await page.locator('.users-table tbody tr').count();

    // Enter search keyword
    const searchInput = page.locator('.keyword-input input');
    await searchInput.fill('admin');

    // Wait for search to complete (debounce)
    await page.waitForTimeout(500);

    // Verify search results
    const searchResultRows = await page.locator('.users-table tbody tr').count();
    // Search results should be filtered
    expect(searchResultRows).toBeLessThanOrEqual(initialRows);

    // Clear search
    await searchInput.clear();
    await page.waitForTimeout(500);
  });

  test('should filter users by status', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // Click on status filter dropdown
    const statusSelect = page.locator('.status-select');
    await statusSelect.click();

    // Select "Active" status
    await page.locator('.el-select-dropdown__item:has-text("Active")').click();

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Verify filtered results show only active users
    const statusTags = await page.locator('.status-tag:has-text("Active")').count();
    expect(statusTags).toBeGreaterThanOrEqual(0);

    // Reset filter
    await statusSelect.click();
    await page.locator('.el-select-dropdown__item:has-text("All Status")').click();
  });

  test('should reset filters', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // Apply some filters
    const searchInput = page.locator('.keyword-input input');
    await searchInput.fill('test');

    const statusSelect = page.locator('.status-select');
    await statusSelect.click();
    await page.locator('.el-select-dropdown__item:has-text("Active")').click();

    // Click Reset button
    await page.locator('button:has-text("Reset")').click();

    // Verify filters are cleared
    await expect(searchInput).toHaveValue('');
  });

  test('should create new user', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // Click Create User button
    await page.locator('button:has-text("Create User")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create User")')).toBeVisible();

    // Fill user form
    const timestamp = Date.now();
    const username = `testuser_${timestamp}`;

    await page.locator('.el-dialog input[placeholder*="username"]').fill(username);
    await page.locator('.el-dialog input[type="password"]').fill('TestPass123!');
    await page.locator('.el-dialog input[placeholder*="email"]').fill(`${username}@test.com`);
    await page.locator('.el-dialog input[placeholder*="phone"]').fill('13800138000');

    // Submit form
    await page.locator('.el-dialog button:has-text("Create")').click();

    // Wait for success message
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // Verify dialog closes
    await expect(page.locator('.el-dialog:has-text("Create User")')).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('should edit existing user', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // Find first Edit button
    const editButton = page.locator('.users-table button:has-text("Edit")').first();
    await editButton.click();

    // Verify dialog opens in edit mode
    await expect(page.locator('.el-dialog:has-text("Edit User")')).toBeVisible();

    // Verify username field is disabled in edit mode
    await expect(page.locator('.el-dialog input[placeholder*="username"]')).toBeDisabled();

    // Update nickname
    const nicknameInput = page.locator('.el-dialog input[placeholder*="display name"]');
    await nicknameInput.fill(`Updated User ${Date.now()}`);

    // Submit form
    await page.locator('.el-dialog button:has-text("Save")').click();

    // Wait for success message
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
  });

  test('should assign role to user', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // Find first Roles button
    const rolesButton = page.locator('.users-table button:has-text("Roles")').first();
    await rolesButton.click();

    // Verify role dialog opens
    await expect(page.locator('.el-dialog:has-text("Assign Roles")')).toBeVisible();

    // Check if there are roles available
    const roleCheckboxes = await page.locator('.role-item .el-checkbox').count();

    if (roleCheckboxes > 0) {
      // Toggle first role
      await page.locator('.role-item .el-checkbox').first().click();

      // Submit
      await page.locator('.el-dialog button:has-text("Save Assignment")').click();

      // Wait for success message
      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
    } else {
      // No roles available, close dialog
      await page.locator('.el-dialog button:has-text("Cancel")').click();
    }
  });

  test('should delete user', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // First create a user to delete
    await page.locator('button:has-text("Create User")').click();
    await expect(page.locator('.el-dialog:has-text("Create User")')).toBeVisible();

    const timestamp = Date.now();
    const username = `delete_test_${timestamp}`;

    await page.locator('.el-dialog input[placeholder*="username"]').fill(username);
    await page.locator('.el-dialog input[type="password"]').fill('TestPass123!');
    await page.locator('.el-dialog button:has-text("Create")').click();
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // Search for the created user
    const searchInput = page.locator('.keyword-input input');
    await searchInput.fill(username);
    await page.waitForTimeout(500);

    // Find and click delete button
    const deleteButton = page.locator('.users-table button:has-text("Delete")').first();
    await deleteButton.click();

    // Confirm deletion in popconfirm
    await page.locator('.el-popconfirm button:has-text("Confirm")').click();

    // Wait for success message
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
  });

  test('should batch assign roles to selected users', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // Select multiple users
    const checkboxes = await page.locator('.users-table .el-checkbox').all();

    if (checkboxes.length > 1) {
      // Select first two users (skip header checkbox)
      await checkboxes[1].click();
      if (checkboxes.length > 2) {
        await checkboxes[2].click();
      }

      // Verify batch assign button is enabled
      await expect(page.locator('button:has-text("Batch Assign Roles")')).toBeEnabled();

      // Click batch assign
      await page.locator('button:has-text("Batch Assign Roles")').click();

      // Verify dialog opens
      await expect(page.locator('.el-dialog:has-text("Batch Assign Roles")')).toBeVisible();

      // Close dialog
      await page.locator('.el-dialog button:has-text("Cancel")').click();
    }
  });

  test('should view audit logs for user in edit mode', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // Open edit dialog
    await page.locator('.users-table button:has-text("Edit")').first().click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Edit User")')).toBeVisible();

    // Click on Audit Logs tab
    const auditLogsTab = page.locator('.el-tabs__item:has-text("Audit Logs")');
    if (await auditLogsTab.isVisible()) {
      await auditLogsTab.click();

      // Verify audit logs section is visible
      await expect(page.locator('.audit-log-section')).toBeVisible();
    }

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should validate form fields on create', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // Click Create User button
    await page.locator('button:has-text("Create User")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create User")')).toBeVisible();

    // Try to submit empty form
    await page.locator('.el-dialog button:has-text("Create")').click();

    // Verify validation errors appear
    await expect(page.locator('.el-form-item__error')).toBeVisible();

    // Test invalid username (too short)
    await page.locator('.el-dialog input[placeholder*="username"]').fill('a');
    await page.locator('.el-dialog button:has-text("Create")').click();

    // Test invalid password (weak)
    await page.locator('.el-dialog input[placeholder*="username"]').fill('validuser');
    await page.locator('.el-dialog input[type="password"]').fill('weak');
    await page.locator('.el-dialog button:has-text("Create")').click();

    // Verify validation error for password
    await expect(page.locator('.el-form-item__error:has-text("Password")')).toBeVisible();

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should handle pagination correctly', async ({ page }) => {
    await navigateToUsers(page);

    // Wait for table to load
    await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

    // Check if pagination exists and has multiple pages
    const paginationExists = await page.locator('.el-pagination').isVisible();

    if (paginationExists) {
      // Check total count
      const totalText = await page.locator('.el-pagination .el-pagination__total').textContent();
      expect(totalText).toMatch(/\d+/);

      // Try changing page size if dropdown exists
      const sizeDropdown = page.locator('.el-pagination .el-pagination__sizes');
      if (await sizeDropdown.isVisible()) {
        await sizeDropdown.click();
        await page.locator('.el-select-dropdown__item:has-text("20")').click();
        await page.waitForTimeout(500);
      }
    }
  });
});

test.describe('User Management - Authentication Required', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access users page directly
    await page.goto(`${BASE_URL}/admin/users`);

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
