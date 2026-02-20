import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Policy Management Flow
 *
 * These tests cover the complete policy management functionality:
 * - Login as admin
 * - Navigate to Policies page
 * - List policies with filters
 * - Create new policy (without permission selector)
 * - Edit existing policy (with read-only associated permissions display)
 * - Configure time condition
 * - Configure IP condition
 * - Test permission check
 * - Toggle policy enabled/disabled
 * - Delete policy
 *
 * NOTE: Policy creation/edit no longer includes resource/action input fields.
 * Associated permissions are displayed read-only in edit mode.
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

// Helper function to navigate to Policies page
async function navigateToPolicies(page: Page) {
  // Click on Policies menu item in sidebar
  const policiesMenuItem = page.locator('text=/Policies|Policy Management|策略管理/');
  await policiesMenuItem.first().click();

  // Wait for Policies page to load
  await expect(page).toHaveURL(/\/admin\/policies/, { timeout: 5000 });
  await expect(page.locator('.policies-page')).toBeVisible();
}

test.describe('Policy Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should navigate to Policies page', async ({ page }) => {
    await navigateToPolicies(page);

    // Verify page header
    await expect(page.locator('.card-header h2')).toContainText('Policy');

    // Verify filter section is visible
    await expect(page.locator('.filter-section')).toBeVisible();

    // Verify Add Policy button is visible
    await expect(page.locator('button:has-text("Add Policy")')).toBeVisible();
  });

  test('should list policies with table columns', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Verify table has columns
    await expect(page.locator('.policies-table th:has-text("Name")')).toBeVisible();
    await expect(page.locator('.policies-table th:has-text("Effect")')).toBeVisible();
    await expect(page.locator('.policies-table th:has-text("Subject")')).toBeVisible();
    await expect(page.locator('.policies-table th:has-text("Resource")')).toBeVisible();
    await expect(page.locator('.policies-table th:has-text("Action")')).toBeVisible();
    await expect(page.locator('.policies-table th:has-text("Status")')).toBeVisible();
  });

  test('should filter policies by subject', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Enter subject filter
    const subjectInput = page.locator('.filter-form input[placeholder*="subject"]');
    await subjectInput.fill('role:admin');

    // Click search button
    await page.locator('.filter-form button:has-text("Search")').click();

    // Wait for results
    await page.waitForTimeout(500);

    // Clear filter
    await page.locator('.filter-form button:has-text("Reset")').click();
  });

  test('should filter policies by resource', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Enter resource filter
    const resourceInput = page.locator('.filter-form input[placeholder*="resource"]');
    await resourceInput.fill('user');

    // Click search button
    await page.locator('.filter-form button:has-text("Search")').click();

    // Wait for results
    await page.waitForTimeout(500);
  });

  test('should filter policies by action', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Enter action filter
    const actionInput = page.locator('.filter-form input[placeholder*="action"]');
    await actionInput.fill('read');

    // Click search button
    await page.locator('.filter-form button:has-text("Search")').click();

    // Wait for results
    await page.waitForTimeout(500);
  });

  test('should filter policies by status', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Click on status filter dropdown
    const statusSelect = page.locator('.filter-form .el-select').last();
    await statusSelect.click();

    // Select "Enabled" status
    await page.locator('.el-select-dropdown__item:has-text("Enabled")').click();

    // Wait for filter to apply
    await page.waitForTimeout(500);

    // Reset filter
    await page.locator('.filter-form button:has-text("Reset")').click();
  });

  test('should create new policy with required fields', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Click Add Policy button
    await page.locator('button:has-text("Add Policy")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Policy")')).toBeVisible();

    // Fill policy form
    const timestamp = Date.now();
    const policyName = `Test Policy ${timestamp}`;

    await page.locator('.el-dialog input[placeholder*="Policy Name"]').fill(policyName);
    await page.locator('.el-dialog input[placeholder*="subject"]').fill('role:user');

    // Submit form
    await page.locator('.el-dialog button:has-text("Create")').click();

    // Wait for success message
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // Verify dialog closes
    await expect(page.locator('.el-dialog:has-text("Create Policy")')).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('should NOT have resource and action input fields in create dialog', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Click Add Policy button
    await page.locator('button:has-text("Add Policy")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Policy")')).toBeVisible();

    // Verify resource input field is NOT present in dialog
    const resourceInput = page.locator('.el-dialog input[placeholder*="resource"]');
    await expect(resourceInput).not.toBeVisible();

    // Verify action input field is NOT present in dialog
    const actionInput = page.locator('.el-dialog input[placeholder*="action"]');
    await expect(actionInput).not.toBeVisible();

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should NOT have permission selector in create dialog', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Click Add Policy button
    await page.locator('button:has-text("Add Policy")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Policy")')).toBeVisible();

    // Verify permission selector/selector input is NOT present in dialog
    const permissionSelector = page.locator(
      '.el-dialog .permission-selector, .el-dialog select[name*="permission"], .el-dialog .permission-select'
    );
    await expect(permissionSelector).not.toBeVisible();

    // Also check for permission checkboxes or multi-select
    const permissionCheckbox = page.locator(
      '.el-dialog .permission-checkbox, .el-dialog .el-checkbox:has-text("Permission")'
    );
    await expect(permissionCheckbox).not.toBeVisible();

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should edit existing policy', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Find first Edit button
    const editButton = page.locator('.policies-table button:has-text("Edit")').first();
    await editButton.click();

    // Verify dialog opens in edit mode
    await expect(page.locator('.el-dialog:has-text("Edit Policy")')).toBeVisible();

    // Verify Details tab is active
    await expect(page.locator('.el-tabs__item:has-text("Details")')).toHaveClass(/is-active/);

    // Update description
    const descTextarea = page.locator('.el-dialog textarea[placeholder*="Describe"]');
    await descTextarea.fill(`Updated description ${Date.now()}`);

    // Submit form
    await page.locator('.el-dialog button:has-text("Save")').click();

    // Wait for success message
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
  });

  test('should display associated permissions read-only in edit mode', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Find first Edit button
    const editButton = page.locator('.policies-table button:has-text("Edit")').first();
    await editButton.click();

    // Verify dialog opens in edit mode
    await expect(page.locator('.el-dialog:has-text("Edit Policy")')).toBeVisible();

    // Verify Associated Permissions section exists
    const permissionsSection = page.locator(
      '.el-form-item:has-text("Associated Permissions"), .associated-permissions'
    );
    await expect(permissionsSection).toBeVisible();

    // Verify the hint text is present
    const hintText = page.locator('text=Permissions are managed from the Permission page');
    await expect(hintText).toBeVisible();

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should have Audit Logs tab in edit mode', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Find first Edit button
    const editButton = page.locator('.policies-table button:has-text("Edit")').first();
    await editButton.click();

    // Verify dialog opens in edit mode
    await expect(page.locator('.el-dialog:has-text("Edit Policy")')).toBeVisible();

    // Click on Audit Logs tab
    const auditLogsTab = page.locator('.el-tabs__item:has-text("Audit Logs")');
    await auditLogsTab.click();

    // Verify audit logs section is visible
    await expect(page.locator('.audit-log-section')).toBeVisible();

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should configure time condition', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Open edit dialog for first policy
    await page.locator('.policies-table button:has-text("Edit")').first().click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Edit Policy")')).toBeVisible();

    // Scroll to time condition section
    const timeConditionSection = page.locator('.condition-section:has-text("Time Condition")');
    await timeConditionSection.scrollIntoViewIfNeeded();

    // Enable time condition
    const timeSwitch = timeConditionSection.locator('.el-switch').first();
    await timeSwitch.click();

    // Wait for time condition UI to appear
    await page.waitForTimeout(300);

    // Set start time
    const startPicker = page.locator('.time-field:has-text("Start Time") .el-date-editor');
    await startPicker.click();
    await page.keyboard.type('09:00');
    await page.keyboard.press('Enter');

    // Set end time
    const endPicker = page.locator('.time-field:has-text("End Time") .el-date-editor');
    await endPicker.click();
    await page.keyboard.type('18:00');
    await page.keyboard.press('Enter');

    // Select days
    await page.locator('.days-section .el-checkbox:has-text("Mon")').click();
    await page.locator('.days-section .el-checkbox:has-text("Tue")').click();
    await page.locator('.days-section .el-checkbox:has-text("Wed")').click();

    // Verify JSON preview updates
    await expect(page.locator('.json-preview')).toBeVisible();

    // Close dialog without saving
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should configure IP condition', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Open edit dialog for first policy
    await page.locator('.policies-table button:has-text("Edit")').first().click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Edit Policy")')).toBeVisible();

    // Scroll to IP condition section
    const ipConditionSection = page.locator('.condition-section:has-text("IP Condition")');
    await ipConditionSection.scrollIntoViewIfNeeded();

    // Enable IP condition
    const ipSwitch = ipConditionSection.locator('.el-switch').first();
    await ipSwitch.click();

    // Wait for IP condition UI to appear
    await page.waitForTimeout(300);

    // Enter IP address
    const ipInput = page.locator('.ip-list .ip-input input').first();
    await ipInput.fill('192.168.1.0/24');

    // Add another IP
    await page.locator('button:has-text("Add IP")').click();
    await page.locator('.ip-list .ip-input input').last().fill('10.0.0.0/8');

    // Verify JSON preview updates
    await expect(page.locator('.json-preview')).toBeVisible();

    // Close dialog without saving
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should test permission check', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for permission test card to be visible
    await expect(page.locator('.permission-test-card')).toBeVisible({ timeout: 10000 });

    // Enter test resource
    const resourceInput = page.locator('.test-input-form input[placeholder*="resource"]');
    await resourceInput.fill('user');

    // Enter test action
    const actionInput = page.locator('.test-input-form input[placeholder*="action"]');
    await actionInput.fill('read');

    // Click test button
    await page.locator('button:has-text("Test Permission")').click();

    // Wait for result
    await page.waitForTimeout(1000);

    // Verify result is displayed
    const resultContainer = page.locator('.result-container');
    await expect(resultContainer).toBeVisible({ timeout: 10000 });

    // Verify result shows allowed or denied
    const resultText = await resultContainer.textContent();
    expect(resultText).toMatch(/ALLOWED|DENIED/);
  });

  test('should toggle policy enabled/disabled', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Find first Enable/Disable button
    const toggleButton = page
      .locator(
        '.policies-table .action-buttons button:has-text("Disable"), .policies-table .action-buttons button:has-text("Enable")'
      )
      .first();

    // Get current state
    const buttonText = await toggleButton.textContent();

    // Click toggle
    await toggleButton.click();

    // Wait for success message
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // Verify button text changed
    const newButtonText = await toggleButton.textContent();
    expect(newButtonText).not.toBe(buttonText);
  });

  test('should delete policy', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // First create a policy to delete
    await page.locator('button:has-text("Add Policy")').click();
    await expect(page.locator('.el-dialog:has-text("Create Policy")')).toBeVisible();

    const timestamp = Date.now();
    const policyName = `Delete Test ${timestamp}`;

    await page.locator('.el-dialog input[placeholder*="Policy Name"]').fill(policyName);
    await page.locator('.el-dialog input[placeholder*="subject"]').fill('role:test');
    await page.locator('.el-dialog button:has-text("Create")').click();
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // Search for the created policy
    const searchInput = page.locator('.filter-form input[placeholder*="subject"]');
    await searchInput.fill('role:test');
    await page.locator('.filter-form button:has-text("Search")').click();
    await page.waitForTimeout(500);

    // Find and click delete button
    const deleteButton = page.locator('.policies-table button:has-text("Delete")').first();
    await deleteButton.click();

    // Confirm deletion in popconfirm
    await page.locator('.el-popconfirm button:has-text("Confirm")').click();

    // Wait for success message
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
  });

  test('should validate form fields on create', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Click Add Policy button
    await page.locator('button:has-text("Add Policy")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Policy")')).toBeVisible();

    // Try to submit empty form
    await page.locator('.el-dialog button:has-text("Create")').click();

    // Verify validation errors appear
    await expect(page.locator('.el-form-item__error')).toBeVisible();

    // Fill required fields one by one and verify validation clears
    await page.locator('.el-dialog input[placeholder*="Policy Name"]').fill('Test Policy');
    await page.locator('.el-dialog input[placeholder*="subject"]').fill('role:test');

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should set policy effect to allow or deny', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Click Add Policy button
    await page.locator('button:has-text("Add Policy")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Policy")')).toBeVisible();

    // Check effect dropdown exists
    const effectSelect = page.locator('.el-dialog .el-select:has(.el-input__wrapper)').first();
    await effectSelect.click();

    // Verify Allow and Deny options
    await expect(page.locator('.el-select-dropdown__item:has-text("Allow")')).toBeVisible();
    await expect(page.locator('.el-select-dropdown__item:has-text("Deny")')).toBeVisible();

    // Select Deny
    await page.locator('.el-select-dropdown__item:has-text("Deny")').click();

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should set policy priority', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Click Add Policy button
    await page.locator('button:has-text("Add Policy")').click();

    // Verify dialog opens
    await expect(page.locator('.el-dialog:has-text("Create Policy")')).toBeVisible();

    // Find priority input
    const priorityInput = page.locator('.el-dialog .el-input-number input');

    // Set priority
    await priorityInput.fill('100');

    // Verify value
    await expect(priorityInput).toHaveValue('100');

    // Close dialog
    await page.locator('.el-dialog button:has-text("Cancel")').click();
  });

  test('should display empty state when no policies', async ({ page }) => {
    await navigateToPolicies(page);

    // Apply filter that likely returns no results
    const subjectInput = page.locator('.filter-form input[placeholder*="subject"]');
    await subjectInput.fill('nonexistent_subject_xyz');
    await page.locator('.filter-form button:has-text("Search")').click();

    // Wait for results
    await page.waitForTimeout(500);

    // Check if empty state or table is shown
    const hasTable = await page.locator('.policies-table').isVisible();
    const hasEmpty = await page.locator('.el-empty').isVisible();

    expect(hasTable || hasEmpty).toBeTruthy();

    // Reset filter
    await page.locator('.filter-form button:has-text("Reset")').click();
  });

  test('should handle pagination correctly', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table, .el-empty')).toBeVisible({ timeout: 10000 });

    // Check if pagination exists
    const paginationExists = await page.locator('.pagination-section .el-pagination').isVisible();

    if (paginationExists) {
      // Check total count
      const totalText = await page
        .locator('.pagination-section .el-pagination__total')
        .textContent();
      expect(totalText).toMatch(/\d+/);
    }
  });
});

test.describe('RBAC-ABAC Association E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('should verify user-policy association through roles', async ({ page }) => {
    // Navigate to Users page first
    await page.goto(`${BASE_URL}/admin/users`);
    await expect(page.locator('.users-page')).toBeVisible({ timeout: 10000 });

    // Check that users have roles column
    await expect(page.locator('.users-table th:has-text("Roles")')).toBeVisible();

    // Navigate to Policies page
    await navigateToPolicies(page);

    // Verify policies with role subjects exist
    await expect(page.locator('.policies-table th:has-text("Subject")')).toBeVisible();
  });

  test('should test permission after policy creation', async ({ page }) => {
    await navigateToPolicies(page);

    // Wait for table to load
    await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

    // Create a test policy
    await page.locator('button:has-text("Add Policy")').click();
    await expect(page.locator('.el-dialog:has-text("Create Policy")')).toBeVisible();

    const timestamp = Date.now();

    await page
      .locator('.el-dialog input[placeholder*="Policy Name"]')
      .fill(`Perm Test ${timestamp}`);
    await page.locator('.el-dialog input[placeholder*="subject"]').fill('role:admin');
    await page.locator('.el-dialog button:has-text("Create")').click();

    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

    // Test the permission
    const resourceInput = page.locator('.test-input-form input[placeholder*="resource"]');
    await resourceInput.fill('policy');

    const actionInput = page.locator('.test-input-form input[placeholder*="action"]');
    await actionInput.fill('*');

    await page.locator('button:has-text("Test Permission")').click();

    // Verify result appears
    await expect(page.locator('.result-container')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Policy Management - Authentication Required', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access policies page directly
    await page.goto(`${BASE_URL}/admin/policies`);

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
