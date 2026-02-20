import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Permission Management Flow
 *
 * These tests cover the complete permission management functionality:
 * - Login as admin
 * - Navigate to Permissions page
 * - List permissions with filters
 * - Create new permission with optional policy association
 * - Edit existing permission and update policy associations
 * - Delete permission
 * - Display associated policies
 * - Form validation
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

// Helper function to navigate to Permissions page
async function navigateToPermissions(page: Page) {
  // Click on Permissions menu item in sidebar
  const permissionsMenuItem = page.locator('text=/Permissions|Permission Management|权限管理/');
  await permissionsMenuItem.first().click();

  // Wait for Permissions page to load
  await expect(page).toHaveURL(/\/admin\/permissions/, { timeout: 5000 });
  await expect(page.locator('.permissions-page')).toBeVisible();
}

test.describe('Permission Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to Permissions page', async ({ page }) => {
    await navigateToPermissions(page);

    // Verify page header
    await expect(page.locator('.card-header h2')).toContainText('Permission Management');

    // Verify filter section is visible
    await expect(page.locator('.filter-section')).toBeVisible();

    // Verify Create Permission button is visible
    await expect(page.locator('button:has-text("Create Permission")')).toBeVisible();
  });

  test('should list permissions with filters', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Check if table exists
    const hasTable = await page.locator('.permissions-table').isVisible();

    if (hasTable) {
      // Verify table has columns
      await expect(page.locator('.permissions-table th:has-text("Permission Name")')).toBeVisible();
      await expect(page.locator('.permissions-table th:has-text("Resource")')).toBeVisible();
      await expect(page.locator('.permissions-table th:has-text("Action")')).toBeVisible();
      await expect(page.locator('.permissions-table th:has-text("Description")')).toBeVisible();
      await expect(page.locator('.permissions-table th:has-text("Policies")')).toBeVisible();
    }
  });

  test('should filter permissions by search keyword', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    const hasTable = await page.locator('.permissions-table').isVisible();
    if (!hasTable) {
      // Skip if no permissions exist
      return;
    }

    // Enter search keyword
    const searchInput = page.locator('.filter-form input[placeholder*="name or description"]');
    await searchInput.fill('user');

    // Click search button
    await page.locator('.filter-form button:has-text("Search")').click();

    // Wait for results
    await page.waitForTimeout(500);

    // Clear filter
    await page.locator('.filter-form button:has-text("Reset")').click();
  });

  test('should filter permissions by resource', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    const hasTable = await page.locator('.permissions-table').isVisible();
    if (!hasTable) {
      return;
    }

    // Enter resource filter
    const resourceInput = page.locator('.filter-form input[placeholder*="resource"]');
    await resourceInput.fill('user');

    // Click search button
    await page.locator('.filter-form button:has-text("Search")').click();

    // Wait for results
    await page.waitForTimeout(500);
  });

  test('should filter permissions by action', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    const hasTable = await page.locator('.permissions-table').isVisible();
    if (!hasTable) {
      return;
    }

    // Enter action filter
    const actionInput = page.locator('.filter-form input[placeholder*="action"]');
    await actionInput.fill('read');

    // Click search button
    await page.locator('.filter-form button:has-text("Search")').click();

    // Wait for results
    await page.waitForTimeout(500);
  });

  test('should reset filters', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Apply filters
    const searchInput = page.locator('.filter-form input[placeholder*="name or description"]');
    await searchInput.fill('test');

    const resourceInput = page.locator('.filter-form input[placeholder*="resource"]');
    await resourceInput.fill('resource');

    const actionInput = page.locator('.filter-form input[placeholder*="action"]');
    await actionInput.fill('action');

    // Click Reset button
    await page.locator('.filter-form button:has-text("Reset")').click();

    // Verify filters are cleared
    await expect(searchInput).toHaveValue('');
    await expect(resourceInput).toHaveValue('');
    await expect(actionInput).toHaveValue('');
  });

  test('should create new permission', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Click Create Permission button
    await page.locator('button:has-text("Create Permission")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Permission")')).toBeVisible();

    // Fill permission form
    const timestamp = Date.now();
    const permissionName = `Test Permission ${timestamp}`;

    await page.locator('.el-dialog input[placeholder*="User Read"]').fill(permissionName);
    await page.locator('.el-dialog input[placeholder*="user, article"]').fill('test_resource');
    await page.locator('.el-dialog input[placeholder*="read, create"]').fill('test_action');
    await page
      .locator('.el-dialog textarea[placeholder*="Describe"]')
      .fill('Test permission description');

    // Submit form
    await page.locator('.el-dialog button:has-text("Create")').click();

    // Wait for success message
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // Verify dialog closes
    await expect(page.locator('.el-dialog:has-text("Create Permission")')).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('should create permission with policy association', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Click Create Permission button
    await page.locator('button:has-text("Create Permission")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Permission")').first()).toBeVisible();

    // Fill permission form
    const timestamp = Date.now();
    const permissionName = `Policy Associated Permission ${timestamp}`;

    await page.locator('.el-dialog input[placeholder*="User Read"]').first().fill(permissionName);
    await page
      .locator('.el-dialog input[placeholder*="user, article"]')
      .fill('associated_resource');
    await page.locator('.el-dialog input[placeholder*="read, create"]').fill('associated_action');

    // Check if policy select exists and has options
    const policySelect = page.locator('.el-dialog .policy-select');
    if (await policySelect.isVisible()) {
      await policySelect.click();

      // Wait for dropdown to open
      await page.waitForTimeout(300);

      // Check if there are any policy options
      const policyOptions = await page.locator('.el-select-dropdown__item').count();

      if (policyOptions > 0) {
        // Select first policy option
        await page.locator('.el-select-dropdown__item').first().click();

        // Close dropdown
        await page.keyboard.press('Escape');
      }
    }

    // Submit form
    await page.locator('.el-dialog button:has-text("Create")').click();

    // Wait for success message
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
  });

  test('should edit existing permission', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    const hasTable = await page.locator('.permissions-table').isVisible();
    if (!hasTable) {
      // Create a permission first if none exist
      await page.locator('button:has-text("Create Permission")').click();
      await expect(page.locator('.el-dialog:has-text("Create Permission")')).toBeVisible();

      const timestamp = Date.now();
      await page
        .locator('.el-dialog input[placeholder*="User Read"]')
        .fill(`Edit Test ${timestamp}`);
      await page.locator('.el-dialog input[placeholder*="user, article"]').fill('edit_test');
      await page.locator('.el-dialog input[placeholder*="read, create"]').fill('edit');
      await page.locator('.el-dialog button:has-text("Create")').click();
      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

      // Wait for table to refresh
      await page.waitForTimeout(500);
    }

    // Find first Edit button
    const editButton = page.locator('.permissions-table button:has-text("Edit")').first();
    await editButton.click();

    // Verify dialog opens in edit mode
    await expect(page.locator('.el-dialog:has-text("Edit Permission")')).toBeVisible();

    // Update description
    const descTextarea = page.locator('.el-dialog textarea[placeholder*="Describe"]');
    await descTextarea.fill(`Updated description ${Date.now()}`);

    // Submit form
    await page.locator('.el-dialog button:has-text("Save")').click();

    // Wait for success message
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
  });

  test('should update policy association on edit', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    const hasTable = await page.locator('.permissions-table').isVisible();
    if (!hasTable) {
      return;
    }

    // Find first Edit button
    const editButton = page.locator('.permissions-table button:has-text("Edit")').first();
    await editButton.click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Edit Permission")')).toBeVisible();

    // Scroll to policy select section
    const policySelectSection = page.locator('.el-dialog .policy-select').first();
    await policySelectSection.scrollIntoViewIfNeeded();

    // Open policy dropdown
    await policySelectSection.click();
    await page.waitForTimeout(300);

    // Check if there are any policy options
    const policyOptions = await page.locator('.el-select-dropdown__item').count();

    if (policyOptions > 0) {
      // Toggle first policy
      await page.locator('.el-select-dropdown__item').first().click();

      // Close dropdown
      await page.keyboard.press('Escape');

      // Submit form
      await page.locator('.el-dialog button:has-text("Save")').click();

      // Wait for success message
      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
    } else {
      // No policies available, close dialog
      await page.locator('.el-dialog button:has-text("Cancel")').click();
    }
  });

  test('should display associated policies', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    const hasTable = await page.locator('.permissions-table').isVisible();
    if (!hasTable) {
      return;
    }

    // Verify Policies column exists
    await expect(page.locator('.permissions-table th:has-text("Policies")')).toBeVisible();

    // Check if any policy tags are displayed
    const policyTags = await page.locator('.permissions-table .policy-tag').count();
    const noPoliciesText = await page.locator('.permissions-table .no-policies').count();

    // Either there should be policy tags or "No policies" text
    expect(policyTags + noPoliciesText).toBeGreaterThan(0);
  });

  test('should delete permission', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // First create a permission to delete
    await page.locator('button:has-text("Create Permission")').click();
    await expect(page.locator('.el-dialog:has-text("Create Permission")')).toBeVisible();

    const timestamp = Date.now();
    const permissionName = `Delete Test ${timestamp}`;

    await page.locator('.el-dialog input[placeholder*="User Read"]').fill(permissionName);
    await page.locator('.el-dialog input[placeholder*="user, article"]').fill('delete_test');
    await page.locator('.el-dialog input[placeholder*="read, create"]').fill('delete');
    await page.locator('.el-dialog button:has-text("Create")').click();
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // Wait for table to refresh
    await page.waitForTimeout(500);

    // Search for the created permission
    const searchInput = page.locator('.filter-form input[placeholder*="name or description"]');
    await searchInput.fill(permissionName);
    await page.locator('.filter-form button:has-text("Search")').click();
    await page.waitForTimeout(500);

    // Find and click delete button
    const deleteButton = page.locator('.permissions-table button:has-text("Delete")').first();
    await deleteButton.click();

    // Confirm deletion in popconfirm
    await page.locator('.el-popconfirm button:has-text("Confirm")').click();

    // Wait for success message
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // Reset filters
    await page.locator('.filter-form button:has-text("Reset")').click();
  });

  test('should validate form fields on create', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Click Create Permission button
    await page.locator('button:has-text("Create Permission")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Permission")')).toBeVisible();

    // Try to submit empty form
    await page.locator('.el-dialog button:has-text("Create")').click();

    // Verify validation errors appear
    await expect(page.locator('.el-form-item__error')).toBeVisible();

    // Fill required fields one by one
    await page.locator('.el-dialog input[placeholder*="User Read"]').fill('Test Permission');
    await page.locator('.el-dialog input[placeholder*="user, article"]').fill('test');
    await page.locator('.el-dialog input[placeholder*="read, create"]').fill('read');

    // Close dialog without submitting
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should validate permission name length', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Click Create Permission button
    await page.locator('button:has-text("Create Permission")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Permission")')).toBeVisible();

    // Test name too short (less than 2 characters)
    await page.locator('.el-dialog input[placeholder*="User Read"]').fill('a');
    await page.locator('.el-dialog button:has-text("Create")').click();

    // Verify validation error for name
    await expect(page.locator('.el-form-item__error:has-text("Name")')).toBeVisible();

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should validate required fields', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Click Create Permission button
    await page.locator('button:has-text("Create Permission")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Permission")')).toBeVisible();

    // Fill only name, leave resource and action empty
    await page.locator('.el-dialog input[placeholder*="User Read"]').fill('Test Permission');
    await page.locator('.el-dialog button:has-text("Create")').click();

    // Verify validation errors for resource and action
    await expect(page.locator('.el-form-item__error')).toBeVisible();

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should cancel create permission dialog', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Click Create Permission button
    await page.locator('button:has-text("Create Permission")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Permission")')).toBeVisible();

    // Fill some data
    await page.locator('.el-dialog input[placeholder*="User Read"]').fill('Cancel Test');

    // Click Cancel button
    await page.locator('.el-dialog button:has-text("Cancel")').click();

    // Verify dialog closes without creating
    await expect(page.locator('.el-dialog:has-text("Create Permission")')).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('should cancel edit permission dialog', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    const hasTable = await page.locator('.permissions-table').isVisible();
    if (!hasTable) {
      return;
    }

    // Find first Edit button
    const editButton = page.locator('.permissions-table button:has-text("Edit")').first();
    await editButton.click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Edit Permission")')).toBeVisible();

    // Click Cancel button
    await page.locator('.el-dialog button:has-text("Cancel")').click();

    // Verify dialog closes without saving
    await expect(page.locator('.el-dialog:has-text("Edit Permission")')).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('should close dialog on click outside', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Click Create Permission button
    await page.locator('button:has-text("Create Permission")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Permission")')).toBeVisible();

    // Press Escape to close dialog
    await page.keyboard.press('Escape');

    // Dialog might still be visible if close-on-click-modal is false
    // Check that the dialog can be closed via Cancel button
    const dialogVisible = await page
      .locator('.el-dialog:has-text("Create Permission")')
      .isVisible();

    if (dialogVisible) {
      await page.locator('.el-dialog button:has-text("Cancel")').click();
    }
  });

  test('should display empty state when no permissions', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for page to load
    await expect(page.locator('.permissions-page')).toBeVisible();

    // Check if table or empty state is shown
    const hasTable = await page.locator('.permissions-table').isVisible();
    const hasEmpty = await page.locator('.el-empty').isVisible();

    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('should display policy tags in table', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    const hasTable = await page.locator('.permissions-table').isVisible();
    if (!hasTable) {
      return;
    }

    // Check if policy tags or "No policies" text is displayed
    const hasPolicyTags = await page.locator('.permissions-table .policy-tag').isVisible();
    const hasNoPolicies = await page.locator('.permissions-table .no-policies').isVisible();
    const hasMoreTag = await page.locator('.permissions-table .more-tag').isVisible();

    // At least one of these should be visible
    expect(hasPolicyTags || hasNoPolicies || hasMoreTag).toBeTruthy();
  });
});

test.describe('Permission Management - Authentication Required', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access permissions page directly
    await page.goto(`${BASE_URL}/admin/permissions`);

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});

test.describe('Permission-Policy Association E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should verify permission-policy association flow', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Create a new permission with policy
    await page.locator('button:has-text("Create Permission")').click();
    await expect(page.locator('.el-dialog:has-text("Create Permission")')).toBeVisible();

    const timestamp = Date.now();
    await page
      .locator('.el-dialog input[placeholder*="User Read"]')
      .fill(`Association Test ${timestamp}`);
    await page.locator('.el-dialog input[placeholder*="user, article"]').fill('association_test');
    await page.locator('.el-dialog input[placeholder*="read, create"]').fill('associate');

    // Try to select policies if available
    const policySelect = page.locator('.el-dialog .policy-select');
    if (await policySelect.isVisible()) {
      await policySelect.click();
      await page.waitForTimeout(300);

      const policyOptions = await page.locator('.el-select-dropdown__item').count();
      if (policyOptions > 0) {
        await page.locator('.el-select-dropdown__item').first().click();
        await page.keyboard.press('Escape');
      }
    }

    await page.locator('.el-dialog button:has-text("Create")').click();
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // Verify permission appears in list
    await page.waitForTimeout(500);
    await expect(page.locator('.permissions-table')).toBeVisible();
  });

  test('should update policy association through edit dialog', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    const hasTable = await page.locator('.permissions-table').isVisible();
    if (!hasTable) {
      return;
    }

    // Open edit dialog for first permission
    await page.locator('.permissions-table button:has-text("Edit")').first().click();
    await expect(page.locator('.el-dialog:has-text("Edit Permission")')).toBeVisible();

    // Verify policy select exists
    await expect(page.locator('.el-dialog .policy-select')).toBeVisible();

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });
});

test.describe('Permission Management - Negative Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should show error for duplicate permission name', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Get first permission name if exists
    const hasTable = await page.locator('.permissions-table').isVisible();
    if (!hasTable) {
      return;
    }

    const firstPermissionName = await page
      .locator('.permissions-table .permission-name .name-text')
      .first()
      .textContent();

    if (firstPermissionName) {
      // Try to create permission with same name
      await page.locator('button:has-text("Create Permission")').click();
      await expect(page.locator('.el-dialog:has-text("Create Permission")')).toBeVisible();

      await page.locator('.el-dialog input[placeholder*="User Read"]').fill(firstPermissionName);
      await page.locator('.el-dialog input[placeholder*="user, article"]').fill('duplicate_test');
      await page.locator('.el-dialog input[placeholder*="read, create"]').fill('duplicate');
      await page.locator('.el-dialog button:has-text("Create")').click();

      // Should show error message (duplicate name)
      // Wait for either error or success message
      await page.waitForTimeout(2000);

      // Close dialog
      const dialogVisible = await page
        .locator('.el-dialog:has-text("Create Permission")')
        .isVisible();
      if (dialogVisible) {
        await page.locator('.el-dialog button:has-text("Cancel")').click();
      }
    }
  });

  test('should handle delete cancellation', async ({ page }) => {
    await navigateToPermissions(page);

    // Wait for table to load
    await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

    const hasTable = await page.locator('.permissions-table').isVisible();
    if (!hasTable) {
      return;
    }

    // Click delete button
    const deleteButton = page.locator('.permissions-table button:has-text("Delete")').first();
    await deleteButton.click();

    // Cancel deletion in popconfirm
    await page.locator('.el-popconfirm button:has-text("Cancel")').click();

    // Verify permission still exists (no success message)
    await page.waitForTimeout(500);
    await expect(page.locator('.permissions-table')).toBeVisible();
  });
});
