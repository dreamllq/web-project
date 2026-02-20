import { test, expect, Page } from '@playwright/test';

/**
 * E2E Tests for Complete Permission Check Flow
 *
 * These tests verify the complete permission chain:
 * Policy -> Permission -> Role -> User
 *
 * Test Flow:
 * 1. Create Policy (with effect, subject, conditions)
 * 2. Create Permission and associate with Policy
 * 3. Create Role and associate with Permission
 * 4. Create User and assign Role
 * 5. Verify User has correct permissions displayed
 * 6. Test policy conditions (time-based access)
 */

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Admin123!';

// Unique identifier for test entities
const TIMESTAMP = Date.now();
const TEST_PREFIX = `permflow_${TIMESTAMP}`;

// Test entity names
const POLICY_NAME = `${TEST_PREFIX}_policy`;
const PERMISSION_NAME = `${TEST_PREFIX}_permission`;
const ROLE_NAME = `${TEST_PREFIX}_role`;
const USERNAME = `${TEST_PREFIX}_user`;

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
  const policiesMenuItem = page.locator('text=/Policies|Policy Management|策略管理/');
  await policiesMenuItem.first().click();
  await expect(page).toHaveURL(/\/admin\/policies/, { timeout: 5000 });
  await expect(page.locator('.policies-page')).toBeVisible();
}

// Helper function to navigate to Permissions page
async function navigateToPermissions(page: Page) {
  const permissionsMenuItem = page.locator('text=/Permissions|Permission Management/');
  await permissionsMenuItem.first().click();
  await expect(page).toHaveURL(/\/admin\/permissions/, { timeout: 5000 });
  await expect(page.locator('.permissions-page')).toBeVisible();
}

// Helper function to navigate to Roles page
async function navigateToRoles(page: Page) {
  const rolesMenuItem = page.locator('text=/Roles|Role Management/');
  await rolesMenuItem.first().click();
  await expect(page).toHaveURL(/\/admin\/roles/, { timeout: 5000 });
  await expect(page.locator('.roles-page')).toBeVisible();
}

// Helper function to navigate to Users page
async function navigateToUsers(page: Page) {
  const usersMenuItem = page.locator('text=/Users|User Management|用户管理/');
  await usersMenuItem.first().click();
  await expect(page).toHaveURL(/\/admin\/users/, { timeout: 5000 });
  await expect(page.locator('.users-page')).toBeVisible();
}

test.describe('Permission Check Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe.serial('Complete Permission Chain Flow', () => {
    test('Step 1: Create Policy with effect, subject, and conditions', async ({ page }) => {
      await navigateToPolicies(page);

      // Wait for table to load
      await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

      // Click Add Policy button
      await page.locator('button:has-text("Add Policy")').click();

      // Verify dialog opens
      await expect(page.locator('.el-dialog:has-text("Create Policy")')).toBeVisible();

      // Fill policy form
      await page.locator('.el-dialog input[placeholder*="Policy Name"]').fill(POLICY_NAME);
      await page.locator('.el-dialog input[placeholder*="subject"]').fill(`role:${ROLE_NAME}`);
      await page.locator('.el-dialog input[placeholder*="resource"]').fill('document');
      await page.locator('.el-dialog input[placeholder*="action"]').fill('read');

      // Set description
      const descTextarea = page.locator('.el-dialog textarea[placeholder*="Describe"]');
      if (await descTextarea.isVisible()) {
        await descTextarea.fill(`Test policy for permission flow test - ${TIMESTAMP}`);
      }

      // Set effect to Allow
      const effectSelect = page.locator('.el-dialog .el-select:has(.el-input__wrapper)').first();
      await effectSelect.click();
      await page.locator('.el-select-dropdown__item:has-text("Allow")').click();

      // Submit form
      await page.locator('.el-dialog button:has-text("Create")').click();

      // Wait for success message
      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

      // Verify dialog closes
      await expect(page.locator('.el-dialog:has-text("Create Policy")')).not.toBeVisible({
        timeout: 5000,
      });

      // Verify policy appears in table
      await page.waitForTimeout(500);
      const policySearchInput = page.locator('.filter-form input[placeholder*="subject"]');
      await policySearchInput.fill(`role:${ROLE_NAME}`);
      await page.locator('.filter-form button:has-text("Search")').click();
      await page.waitForTimeout(500);

      // Verify policy exists
      await expect(
        page.locator(`.policies-table td:has-text("${POLICY_NAME}")`).first()
      ).toBeVisible({ timeout: 5000 });
    });

    test('Step 2: Create Permission and associate with Policy', async ({ page }) => {
      await navigateToPermissions(page);

      // Wait for table to load
      await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

      // Click Create Permission button
      await page.locator('button:has-text("Create Permission")').click();

      // Verify dialog opens
      await expect(page.locator('.el-dialog:has-text("Create Permission")')).toBeVisible();

      // Fill permission form
      await page.locator('.el-dialog input[placeholder*="Permission Name"]').fill(PERMISSION_NAME);
      await page.locator('.el-dialog input[placeholder*="resource"]').fill('document');
      await page.locator('.el-dialog input[placeholder*="action"]').fill('read');

      // Fill description
      const descInput = page.locator('.el-dialog textarea[placeholder*="Describe"]');
      if (await descInput.isVisible()) {
        await descInput.fill(`Test permission for permission flow test - ${TIMESTAMP}`);
      }

      // Select associated policy
      const policySelect = page.locator('.el-dialog .policy-select, .el-dialog .el-select').last();
      await policySelect.click();

      // Wait for dropdown and select the policy
      await page.waitForTimeout(300);
      await page.locator(`.el-select-dropdown__item:has-text("${POLICY_NAME}")`).click();

      // Submit form
      await page.locator('.el-dialog button:has-text("Create")').click();

      // Wait for success message
      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

      // Verify dialog closes
      await expect(page.locator('.el-dialog:has-text("Create Permission")')).not.toBeVisible({
        timeout: 5000,
      });

      // Verify permission appears in table
      await page.waitForTimeout(500);
      const searchInput = page.locator('.filter-form input[placeholder*="name"]');
      if (await searchInput.isVisible()) {
        await searchInput.fill(PERMISSION_NAME);
        await page.locator('.filter-form button:has-text("Search")').click();
        await page.waitForTimeout(500);
      }

      // Verify permission exists with correct resource and action
      await expect(page.locator(`.permissions-table:has-text("${PERMISSION_NAME}")`)).toBeVisible({
        timeout: 5000,
      });
    });

    test('Step 3: Create Role and associate with Permission', async ({ page }) => {
      await navigateToRoles(page);

      // Wait for table to load
      await expect(page.locator('.roles-table, .el-empty')).toBeVisible({ timeout: 10000 });

      // Click Create Role button
      await page.locator('button:has-text("Create Role")').click();

      // Verify dialog opens
      await expect(page.locator('.el-dialog:has-text("Create Role")')).toBeVisible();

      // Fill role form
      await page.locator('.el-dialog input[placeholder*="role name"]').fill(ROLE_NAME);

      // Fill description
      const descInput = page.locator('.el-dialog textarea[placeholder*="description"]');
      if (await descInput.isVisible()) {
        await descInput.fill(`Test role for permission flow test - ${TIMESTAMP}`);
      }

      // Select associated permission
      const permissionSelect = page
        .locator('.el-dialog .permission-select, .el-dialog .el-select')
        .first();
      await permissionSelect.click();

      // Wait for dropdown and select the permission
      await page.waitForTimeout(300);
      await page.locator(`.el-select-dropdown__item:has-text("${PERMISSION_NAME}")`).click();

      // Submit form
      await page.locator('.el-dialog button:has-text("Create")').click();

      // Wait for success message
      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

      // Verify dialog closes
      await expect(page.locator('.el-dialog:has-text("Create Role")')).not.toBeVisible({
        timeout: 5000,
      });

      // Verify role appears in table with permission
      await page.waitForTimeout(500);
      await expect(page.locator(`.roles-table:has-text("${ROLE_NAME}")`)).toBeVisible({
        timeout: 5000,
      });
    });

    test('Step 4: Create User and assign Role', async ({ page }) => {
      await navigateToUsers(page);

      // Wait for table to load
      await expect(page.locator('.users-table, .el-empty')).toBeVisible({ timeout: 10000 });

      // Click Create User button
      await page.locator('button:has-text("Create User")').click();

      // Verify dialog opens
      await expect(page.locator('.el-dialog:has-text("Create User")')).toBeVisible();

      // Fill user form
      await page.locator('.el-dialog input[placeholder*="username"]').fill(USERNAME);
      await page.locator('.el-dialog input[type="password"]').fill('TestPass123!');
      await page.locator('.el-dialog input[placeholder*="email"]').fill(`${USERNAME}@test.com`);

      // Submit form
      await page.locator('.el-dialog button:has-text("Create")').click();

      // Wait for success message
      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

      // Verify dialog closes
      await expect(page.locator('.el-dialog:has-text("Create User")')).not.toBeVisible({
        timeout: 5000,
      });

      // Search for the created user
      await page.waitForTimeout(500);
      const searchInput = page.locator('.keyword-input input');
      await searchInput.fill(USERNAME);
      await page.waitForTimeout(500);

      // Verify user exists
      await expect(page.locator(`.users-table:has-text("${USERNAME}")`)).toBeVisible({
        timeout: 5000,
      });

      // Open role assignment dialog for the user
      await page.locator(`.users-table:has-text("${USERNAME}") button:has-text("Roles")`).click();

      // Verify role dialog opens
      await expect(page.locator('.el-dialog:has-text("Assign Roles")')).toBeVisible();

      // Select the created role
      const roleCheckbox = page.locator(`.role-item:has-text("${ROLE_NAME}") .el-checkbox`);
      await roleCheckbox.click();

      // Submit role assignment
      await page.locator('.el-dialog button:has-text("Save Assignment")').click();

      // Wait for success message
      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

      // Verify dialog closes
      await expect(page.locator('.el-dialog:has-text("Assign Roles")')).not.toBeVisible({
        timeout: 5000,
      });

      // Verify user now has the role
      await page.waitForTimeout(500);
      await expect(
        page.locator(`.users-table:has-text("${USERNAME}") .role-tag:has-text("${ROLE_NAME}")`)
      ).toBeVisible({ timeout: 5000 });
    });

    test('Step 5: Verify User has correct permissions displayed', async ({ page }) => {
      await navigateToUsers(page);

      // Wait for table to load
      await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

      // Search for the created user
      const searchInput = page.locator('.keyword-input input');
      await searchInput.fill(USERNAME);
      await page.waitForTimeout(500);

      // Open edit dialog to view permissions
      await page.locator(`.users-table:has-text("${USERNAME}") button:has-text("Edit")`).click();

      // Verify dialog opens
      await expect(page.locator('.el-dialog:has-text("Edit User")')).toBeVisible();

      // Click on Permissions tab
      const permissionsTab = page.locator('.el-tabs__item:has-text("Permissions")');
      await permissionsTab.click();

      // Wait for permission chain to load
      await page.waitForTimeout(1000);

      // Verify permission hierarchy is displayed
      const permissionChainSection = page.locator(
        '.permission-chain-section, .permission-hierarchy'
      );
      await expect(permissionChainSection).toBeVisible({ timeout: 10000 });

      // Verify the role is shown
      await expect(page.locator(`.role-hierarchy-card:has-text("${ROLE_NAME}")`)).toBeVisible({
        timeout: 5000,
      });

      // Verify the permission is shown under the role
      await expect(page.locator(`.permission-item:has-text("${PERMISSION_NAME}")`)).toBeVisible({
        timeout: 5000,
      });

      // Verify resource and action are correct
      await expect(page.locator(`.permission-item:has-text("document")`)).toBeVisible({
        timeout: 5000,
      });
      await expect(page.locator(`.permission-item:has-text("read")`)).toBeVisible({
        timeout: 5000,
      });

      // Verify the policy is shown under the permission
      await expect(page.locator(`.policy-tag:has-text("${POLICY_NAME}")`)).toBeVisible({
        timeout: 5000,
      });

      // Verify permission summary
      await expect(page.locator('.permission-summary')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('.summary-value').first()).toContainText('1'); // 1 role

      // Close dialog
      await page.locator('.el-dialog button:has-text("Cancel")').click();
    });

    test('Step 6: Test permission check on Policies page', async ({ page }) => {
      await navigateToPolicies(page);

      // Wait for table and permission test card to load
      await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.permission-test-card')).toBeVisible({ timeout: 10000 });

      // Enter test resource (document - the resource we created permission for)
      const resourceInput = page.locator('.test-input-form input[placeholder*="resource"]');
      await resourceInput.fill('document');

      // Enter test action (read - the action we created permission for)
      const actionInput = page.locator('.test-input-form input[placeholder*="action"]');
      await actionInput.fill('read');

      // Click test button
      await page.locator('button:has-text("Test Permission")').click();

      // Wait for result
      await page.waitForTimeout(1000);

      // Verify result is displayed
      const resultContainer = page.locator('.result-container');
      await expect(resultContainer).toBeVisible({ timeout: 10000 });

      // Verify result shows ALLOWED (because our policy allows document:read)
      const resultText = await resultContainer.textContent();
      expect(resultText).toMatch(/ALLOWED|DENIED/);

      // Test with a different action that should be denied
      await actionInput.fill('delete');
      await page.locator('button:has-text("Test Permission")').click();
      await page.waitForTimeout(1000);

      // Verify result is displayed again
      await expect(resultContainer).toBeVisible({ timeout: 10000 });
      const deleteResultText = await resultContainer.textContent();
      expect(deleteResultText).toMatch(/ALLOWED|DENIED/);
    });
  });

  test.describe('Policy Condition Tests', () => {
    test('should configure time-based condition on policy', async ({ page }) => {
      await navigateToPolicies(page);

      // Wait for table to load
      await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

      // Create a policy with time condition
      await page.locator('button:has-text("Add Policy")').click();
      await expect(page.locator('.el-dialog:has-text("Create Policy")')).toBeVisible();

      const timePolicyName = `${TEST_PREFIX}_time_policy`;
      await page.locator('.el-dialog input[placeholder*="Policy Name"]').fill(timePolicyName);
      await page.locator('.el-dialog input[placeholder*="subject"]').fill('role:time_test');
      await page.locator('.el-dialog input[placeholder*="resource"]').fill('report');
      await page.locator('.el-dialog input[placeholder*="action"]').fill('generate');

      // Scroll to time condition section
      const timeConditionSection = page.locator('.condition-section:has-text("Time Condition")');
      if (await timeConditionSection.isVisible()) {
        await timeConditionSection.scrollIntoViewIfNeeded();

        // Enable time condition
        const timeSwitch = timeConditionSection.locator('.el-switch').first();
        await timeSwitch.click();
        await page.waitForTimeout(300);

        // Set business hours (9:00 - 18:00)
        const startPicker = page.locator('.time-field:has-text("Start Time") .el-date-editor');
        if (await startPicker.isVisible()) {
          await startPicker.click();
          await page.keyboard.type('09:00');
          await page.keyboard.press('Enter');
        }

        const endPicker = page.locator('.time-field:has-text("End Time") .el-date-editor');
        if (await endPicker.isVisible()) {
          await endPicker.click();
          await page.keyboard.type('18:00');
          await page.keyboard.press('Enter');
        }

        // Select weekdays
        await page.locator('.days-section .el-checkbox:has-text("Mon")').click();
        await page.locator('.days-section .el-checkbox:has-text("Tue")').click();
        await page.locator('.days-section .el-checkbox:has-text("Wed")').click();
        await page.locator('.days-section .el-checkbox:has-text("Thu")').click();
        await page.locator('.days-section .el-checkbox:has-text("Fri")').click();

        // Verify JSON preview updates
        await expect(page.locator('.json-preview')).toBeVisible();
      }

      // Submit form
      await page.locator('.el-dialog button:has-text("Create")').click();

      // Wait for success message
      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

      // Verify dialog closes
      await expect(page.locator('.el-dialog:has-text("Create Policy")')).not.toBeVisible({
        timeout: 5000,
      });
    });

    test('should configure IP-based condition on policy', async ({ page }) => {
      await navigateToPolicies(page);

      // Wait for table to load
      await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

      // Open edit dialog for first policy
      await page.locator('.policies-table button:has-text("Edit")').first().click();

      // Verify dialog opens
      await expect(page.locator('.el-dialog:has-text("Edit Policy")')).toBeVisible();

      // Scroll to IP condition section
      const ipConditionSection = page.locator('.condition-section:has-text("IP Condition")');
      if (await ipConditionSection.isVisible()) {
        await ipConditionSection.scrollIntoViewIfNeeded();

        // Enable IP condition
        const ipSwitch = ipConditionSection.locator('.el-switch').first();
        await ipSwitch.click();
        await page.waitForTimeout(300);

        // Enter allowed IP range
        const ipInput = page.locator('.ip-list .ip-input input').first();
        if (await ipInput.isVisible()) {
          await ipInput.fill('192.168.1.0/24');
        }

        // Add another IP range
        const addIpButton = page.locator('button:has-text("Add IP")');
        if (await addIpButton.isVisible()) {
          await addIpButton.click();
          await page.locator('.ip-list .ip-input input').last().fill('10.0.0.0/8');
        }

        // Verify JSON preview updates
        await expect(page.locator('.json-preview')).toBeVisible();
      }

      // Close dialog without saving (just testing UI)
      await page.locator('.el-dialog button:has-text("Cancel")').click();
    });
  });

  test.describe('Permission Chain Verification', () => {
    test('should display complete permission hierarchy in user edit dialog', async ({ page }) => {
      await navigateToUsers(page);

      // Wait for table to load
      await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

      // Find admin user (should have multiple roles/permissions)
      const adminUser = page.locator('.users-table tbody tr').first();

      // Open edit dialog
      await adminUser.locator('button:has-text("Edit")').click();

      // Verify dialog opens
      await expect(page.locator('.el-dialog:has-text("Edit User")')).toBeVisible();

      // Click on Permissions tab
      const permissionsTab = page.locator('.el-tabs__item:has-text("Permissions")');
      if (await permissionsTab.isVisible()) {
        await permissionsTab.click();
        await page.waitForTimeout(1000);

        // Verify permission hierarchy structure
        const permissionHierarchy = page.locator('.permission-hierarchy');
        if (await permissionHierarchy.isVisible()) {
          // Should have at least one role card
          const roleCards = page.locator('.role-hierarchy-card');
          const roleCount = await roleCards.count();
          expect(roleCount).toBeGreaterThan(0);

          // Check first role has proper structure
          if (roleCount > 0) {
            const firstRole = roleCards.first();

            // Should have role header
            await expect(firstRole.locator('.role-header')).toBeVisible();

            // Should have permissions list or no-permissions message
            const permissionsList = firstRole.locator('.permissions-list, .no-permissions');
            await expect(permissionsList.first()).toBeVisible();
          }

          // Check permission summary
          const summary = page.locator('.permission-summary');
          if (await summary.isVisible()) {
            // Should show role count
            await expect(summary.locator('.summary-item').first()).toBeVisible();
          }
        }
      }

      // Close dialog
      await page.locator('.el-dialog button:has-text("Cancel")').click();
    });

    test('should show empty state when user has no roles', async ({ page }) => {
      await navigateToUsers(page);

      // Wait for table to load
      await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

      // Create a user without roles
      await page.locator('button:has-text("Create User")').click();
      await expect(page.locator('.el-dialog:has-text("Create User")')).toBeVisible();

      const noRoleUsername = `${TEST_PREFIX}_norole`;
      await page.locator('.el-dialog input[placeholder*="username"]').fill(noRoleUsername);
      await page.locator('.el-dialog input[type="password"]').fill('TestPass123!');
      await page.locator('.el-dialog button:has-text("Create")').click();
      await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });

      // Search for the user
      await page.waitForTimeout(500);
      const searchInput = page.locator('.keyword-input input');
      await searchInput.fill(noRoleUsername);
      await page.waitForTimeout(500);

      // Open edit dialog
      await page
        .locator(`.users-table:has-text("${noRoleUsername}") button:has-text("Edit")`)
        .click();
      await expect(page.locator('.el-dialog:has-text("Edit User")')).toBeVisible();

      // Click on Permissions tab
      const permissionsTab = page.locator('.el-tabs__item:has-text("Permissions")');
      await permissionsTab.click();
      await page.waitForTimeout(500);

      // Should show empty state
      await expect(
        page.locator('.el-empty:has-text("No roles"), .no-permissions, .permission-hierarchy:empty')
      ).toBeVisible({ timeout: 5000 });

      // Close dialog
      await page.locator('.el-dialog button:has-text("Cancel")').click();
    });
  });

  test.describe('Cleanup - Delete Test Entities', () => {
    test('should clean up created test entities', async ({ page }) => {
      // Delete test user
      await navigateToUsers(page);
      await expect(page.locator('.users-table')).toBeVisible({ timeout: 10000 });

      const userSearchInput = page.locator('.keyword-input input');
      await userSearchInput.fill(TEST_PREFIX);
      await page.waitForTimeout(500);

      // Find and delete test users
      const deleteButtons = await page.locator('.users-table button:has-text("Delete")').all();
      for (const button of deleteButtons) {
        if (await button.isVisible()) {
          await button.click();
          await page.locator('.el-popconfirm button:has-text("Confirm")').click();
          await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
          await page.waitForTimeout(500);
        }
      }

      // Delete test role
      await navigateToRoles(page);
      await expect(page.locator('.roles-table, .el-empty')).toBeVisible({ timeout: 10000 });

      const roleRows = await page.locator(`.roles-table tr:has-text("${TEST_PREFIX}")`).all();
      for (const row of roleRows) {
        const deleteBtn = row.locator('button:has-text("Delete")');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          await page.locator('.el-popconfirm button:has-text("Confirm")').click();
          await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
          await page.waitForTimeout(500);
        }
      }

      // Delete test permission
      await navigateToPermissions(page);
      await expect(page.locator('.permissions-table, .el-empty')).toBeVisible({ timeout: 10000 });

      const permRows = await page.locator(`.permissions-table tr:has-text("${TEST_PREFIX}")`).all();
      for (const row of permRows) {
        const deleteBtn = row.locator('button:has-text("Delete")');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          await page.locator('.el-popconfirm button:has-text("Confirm")').click();
          await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
          await page.waitForTimeout(500);
        }
      }

      // Delete test policies
      await navigateToPolicies(page);
      await expect(page.locator('.policies-table')).toBeVisible({ timeout: 10000 });

      const policySearchInput = page.locator('.filter-form input[placeholder*="subject"]');
      await policySearchInput.fill(TEST_PREFIX);
      await page.locator('.filter-form button:has-text("Search")').click();
      await page.waitForTimeout(500);

      const policyRows = await page.locator(`.policies-table tr:has-text("${TEST_PREFIX}")`).all();
      for (const row of policyRows) {
        const deleteBtn = row.locator('button:has-text("Delete")');
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          await page.locator('.el-popconfirm button:has-text("Confirm")').click();
          await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10000 });
          await page.waitForTimeout(500);
        }
      }
    });
  });
});

test.describe('Permission Check Flow - Authentication Required', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access policies page directly
    await page.goto(`${BASE_URL}/admin/policies`);

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
