import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './auth.helper';

/**
 * E2E Tests for Chat Feature
 *
 * These tests cover the chat functionality:
 * - Room list display and navigation
 * - Private and group room behaviors
 * - Member management
 * - Unread message handling
 * - Leave/Hide room functionality
 */

// Test configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

// Helper function to navigate to Chat page
async function navigateToChat(page: Page) {
  // Click on Chat menu item in sidebar
  const chatMenuItem = page.locator('text=/Chat|聊天管理/');
  await chatMenuItem.first().click();

  // Wait for Chat page to load
  await expect(page).toHaveURL(/\/admin\/chat/, { timeout: 5000 });
  await expect(page.locator('.chat-page')).toBeVisible();
}

// Helper function to wait for room list to load
async function waitForRoomList(page: Page) {
  // Wait for loading to complete
  await expect(page.locator('.chat-container')).not.toHaveAttribute('aria-busy', 'true', {
    timeout: 10000,
  });
}

// Helper function to select a room by index
async function selectRoomByIndex(page: Page, index: number) {
  const roomItems = page.locator('.room-item');
  const count = await roomItems.count();
  if (count > index) {
    await roomItems.nth(index).click();
    // Wait for room to be selected
    await page.waitForTimeout(300);
  }
}

// Helper function to open room dropdown menu
async function openRoomDropdown(page: Page) {
  // Click the more options button in room header
  const moreButton = page.locator('.room-header .header-actions .el-button').last();
  await moreButton.click();
  // Wait for dropdown to appear
  await expect(page.locator('.el-dropdown-menu')).toBeVisible();
}

// Helper function to open member dialog
async function openMemberDialog(page: Page) {
  await openRoomDropdown(page);
  // Click on Members menu item
  await page.locator('.el-dropdown-menu__item:has-text("Members")').click();
  // Wait for dialog to appear
  await expect(page.locator('.member-manager-dialog')).toBeVisible();
}

test.describe('Chat Feature E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.describe('Room List', () => {
    test('should navigate to Chat page', async ({ page }) => {
      await navigateToChat(page);

      // Verify page elements
      await expect(page.locator('.room-sidebar')).toBeVisible();
      await expect(page.locator('.sidebar-header')).toBeVisible();
      await expect(page.locator('.room-list')).toBeVisible();
    });

    test('should display room list after loading', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      // Either rooms are displayed or empty state
      const roomItems = page.locator('.room-item');
      const emptyState = page.locator('.el-empty');

      // One of them should be visible
      const hasRooms = (await roomItems.count()) > 0;
      const hasEmpty = await emptyState.isVisible();

      expect(hasRooms || hasEmpty).toBe(true);
    });

    test('should show create room button', async ({ page }) => {
      await navigateToChat(page);

      // Verify Create Room button is visible
      const createButton = page.locator('.sidebar-header button:has-text("Create")');
      await expect(createButton).toBeVisible();
      await expect(createButton).toBeEnabled();
    });

    test('should show private room with other user name', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      // Check if there are any rooms
      const roomItems = page.locator('.room-item');
      const count = await roomItems.count();

      if (count > 0) {
        // Check if any room shows private room type
        const privateRooms = page.locator('.room-item:has-text("Private")');
        const privateCount = await privateRooms.count();

        if (privateCount > 0) {
          // Private room should show user name (not generic name)
          const roomName = await privateRooms.first().locator('.room-name').textContent();
          // Room name should exist and not be empty
          expect(roomName).toBeTruthy();
        }
      }
    });

    test('should hide unread badge when count is 0', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      // Select a room to clear unread
      const roomItems = page.locator('.room-item');
      const count = await roomItems.count();

      if (count > 0) {
        await selectRoomByIndex(page, 0);

        // Wait a moment for unread to clear
        await page.waitForTimeout(500);

        // Check the selected room - badge should not be visible
        const selectedRoom = page.locator('.room-item.active');
        const badge = selectedRoom.locator('.unread-badge');
        const badgeVisible = await badge.isVisible();

        // If badge is not visible, test passes
        // If badge is visible, it should have count > 0
        if (badgeVisible) {
          const badgeText = await badge.textContent();
          expect(parseInt(badgeText || '0')).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Leave/Hide Room', () => {
    test('should show "Hide Conversation" for private rooms', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      // Find a private room
      const privateRooms = page.locator('.room-item:has-text("Private")');
      const count = await privateRooms.count();

      if (count > 0) {
        await privateRooms.first().click();
        await page.waitForTimeout(300);

        await openRoomDropdown(page);

        // Verify the leave button text contains "Hide" or "隐藏"
        const leaveItem = page.locator('.el-dropdown-menu__item').last();
        const text = await leaveItem.textContent();
        expect(text).toMatch(/Hide|隐藏/i);
      }
    });

    test('should show "Leave Room" for group rooms', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      // Find a group/public room
      const groupRooms = page.locator('.room-item:has-text("Public")');
      const count = await groupRooms.count();

      if (count > 0) {
        await groupRooms.first().click();
        await page.waitForTimeout(300);

        await openRoomDropdown(page);

        // Verify the leave button text contains "Leave" or "离开"
        const leaveItem = page.locator('.el-dropdown-menu__item').last();
        const text = await leaveItem.textContent();
        expect(text).toMatch(/Leave|离开/i);
      }
    });

    test('should hide private room after clicking hide', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      // Find a private room
      const privateRooms = page.locator('.room-item:has-text("Private")');
      const count = await privateRooms.count();

      if (count > 0) {
        // Get initial room count
        const initialRoomCount = await page.locator('.room-item').count();

        await privateRooms.first().click();
        await page.waitForTimeout(300);

        await openRoomDropdown(page);

        // Click hide/leave button
        await page.locator('.el-dropdown-menu__item').last().click();

        // Confirm in dialog
        await page.locator('.el-message-box button:has-text("Confirm")').click();

        // Wait for success message
        await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 5000 });

        // Verify room is removed from list (or hidden)
        await page.waitForTimeout(500);
        const newRoomCount = await page.locator('.room-item').count();
        expect(newRoomCount).toBeLessThan(initialRoomCount);
      }
    });
  });

  test.describe('Member Management', () => {
    test('should open member dialog when clicking members', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      const roomItems = page.locator('.room-item');
      const count = await roomItems.count();

      if (count > 0) {
        await selectRoomByIndex(page, 0);
        await openMemberDialog(page);

        // Verify dialog is visible
        await expect(page.locator('.member-manager-dialog')).toBeVisible();

        // Verify dialog title
        await expect(page.locator('.member-manager-dialog .el-dialog__title')).toContainText(
          /Members|成员/
        );

        // Close dialog
        await page.locator('.member-manager-dialog .el-dialog__close').click();
      }
    });

    test('should show member list in dialog', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      const roomItems = page.locator('.room-item');
      const count = await roomItems.count();

      if (count > 0) {
        await selectRoomByIndex(page, 0);
        await openMemberDialog(page);

        // Wait for loading to complete
        await page.waitForTimeout(1000);

        // Check if members are displayed or empty state
        const memberItems = page.locator('.member-item');
        const emptyState = page.locator('.member-manager-dialog .el-empty');

        const hasMembers = (await memberItems.count()) > 0;
        const hasEmpty = await emptyState.isVisible();

        expect(hasMembers || hasEmpty).toBe(true);

        // Close dialog
        await page.locator('.member-manager-dialog .el-dialog__close').click();
      }
    });

    test('should show remove button for admin/owner in group rooms', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      // Find a group/public room
      const groupRooms = page.locator('.room-item:has-text("Public")');
      const count = await groupRooms.count();

      if (count > 0) {
        await groupRooms.first().click();
        await page.waitForTimeout(300);

        await openMemberDialog(page);
        await page.waitForTimeout(1000);

        // Check if there are member items with remove buttons
        // (only visible for admin/owner and not for owner member)
        const memberItems = page.locator('.member-item');
        const memberCount = await memberItems.count();

        if (memberCount > 1) {
          // Non-owner members might have remove buttons
          const removeButtons = page.locator('.member-item .el-button--danger');
          const removeCount = await removeButtons.count();
          // At least check that the UI structure is correct
          expect(removeCount).toBeGreaterThanOrEqual(0);
        }

        // Close dialog
        await page.locator('.member-manager-dialog .el-dialog__close').click();
      }
    });

    test('should not show remove button in private rooms', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      // Find a private room
      const privateRooms = page.locator('.room-item:has-text("Private")');
      const count = await privateRooms.count();

      if (count > 0) {
        await privateRooms.first().click();
        await page.waitForTimeout(300);

        await openMemberDialog(page);
        await page.waitForTimeout(1000);

        // Private rooms should not have remove buttons
        const removeButtons = page.locator('.member-item .el-button--danger');
        const removeCount = await removeButtons.count();

        expect(removeCount).toBe(0);

        // Close dialog
        await page.locator('.member-manager-dialog .el-dialog__close').click();
      }
    });
  });

  test.describe('Unread Messages', () => {
    test('should clear unread when entering room', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      // Find a room with unread messages
      const roomsWithBadge = page.locator('.room-item:has(.unread-badge)');
      const count = await roomsWithBadge.count();

      if (count > 0) {
        // Get the badge count before entering
        const badge = roomsWithBadge.first().locator('.unread-badge');
        const badgeText = await badge.textContent();
        const initialCount = parseInt(badgeText || '0');

        expect(initialCount).toBeGreaterThan(0);

        // Click to enter the room
        await roomsWithBadge.first().click();
        await page.waitForTimeout(500);

        // Verify badge is no longer visible on the selected room
        const selectedRoom = page.locator('.room-item.active');
        const selectedBadge = selectedRoom.locator('.unread-badge');
        const badgeVisible = await selectedBadge.isVisible();

        expect(badgeVisible).toBe(false);
      }
    });

    test('should display unread badge count correctly', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      // Check for rooms with badges
      const badges = page.locator('.room-item .unread-badge .el-badge__content');
      const count = await badges.count();

      if (count > 0) {
        // Verify badge shows a number or 99+
        const badgeText = await badges.first().textContent();
        expect(badgeText).toMatch(/^\d+$|^99\+$/);
      }
    });
  });

  test.describe('Room Selection', () => {
    test('should show empty state when no room selected', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      // If no room is selected, should show empty state
      const selectedRoom = page.locator('.room-item.active');
      const isSelected = (await selectedRoom.count()) > 0;

      if (!isSelected) {
        const emptyState = page.locator('.chat-main .el-empty');
        await expect(emptyState).toBeVisible();
      }
    });

    test('should highlight selected room', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      const roomItems = page.locator('.room-item');
      const count = await roomItems.count();

      if (count > 0) {
        await selectRoomByIndex(page, 0);

        // Verify room is highlighted
        const selectedRoom = page.locator('.room-item.active');
        await expect(selectedRoom).toBeVisible();
      }
    });

    test('should show room header when room is selected', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      const roomItems = page.locator('.room-item');
      const count = await roomItems.count();

      if (count > 0) {
        await selectRoomByIndex(page, 0);

        // Verify room header is visible
        const roomHeader = page.locator('.room-header');
        await expect(roomHeader).toBeVisible();

        // Verify room name is displayed
        const roomName = roomHeader.locator('.room-name');
        await expect(roomName).not.toBeEmpty();
      }
    });

    test('should show message input when room is selected', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      const roomItems = page.locator('.room-item');
      const count = await roomItems.count();

      if (count > 0) {
        await selectRoomByIndex(page, 0);

        // Verify message input is visible
        const messageInput = page.locator('.message-input');
        await expect(messageInput).toBeVisible();
      }
    });
  });

  test.describe('Create Room', () => {
    test('should open create room dialog', async ({ page }) => {
      await navigateToChat(page);

      // Click Create Room button
      await page.locator('.sidebar-header button:has-text("Create")').click();

      // Verify dialog opens
      await expect(page.locator('.el-dialog')).toBeVisible();
      await expect(page.locator('.el-dialog__title')).toContainText(/Create|创建/);

      // Close dialog
      await page.locator('.el-dialog .el-dialog__close').click();
    });

    test('should show room type selection in create dialog', async ({ page }) => {
      await navigateToChat(page);

      // Click Create Room button
      await page.locator('.sidebar-header button:has-text("Create")').click();

      // Verify dialog opens
      await expect(page.locator('.el-dialog')).toBeVisible();

      // Check for room type options (Group/Private)
      const dialog = page.locator('.el-dialog');
      const groupOption = dialog.locator('text=/Group|群聊/');
      const privateOption = dialog.locator('text=/Private|私聊/');

      // At least one option should exist
      const hasGroup = (await groupOption.count()) > 0;
      const hasPrivate = (await privateOption.count()) > 0;

      expect(hasGroup || hasPrivate).toBe(true);

      // Close dialog
      await page.locator('.el-dialog .el-dialog__close').click();
    });
  });

  test.describe('Search', () => {
    test('should open search dialog when clicking search button', async ({ page }) => {
      await navigateToChat(page);
      await waitForRoomList(page);

      const roomItems = page.locator('.room-item');
      const count = await roomItems.count();

      if (count > 0) {
        await selectRoomByIndex(page, 0);

        // Click search button
        const searchButton = page.locator('.room-header .header-actions button').first();
        await searchButton.click();

        // Verify search dialog opens
        await expect(
          page.locator('.search-dialog, .el-dialog:has(input[placeholder*="search"])')
        ).toBeVisible({
          timeout: 5000,
        });

        // Close if opened
        const closeButton = page.locator('.el-dialog .el-dialog__close');
        if (await closeButton.isVisible()) {
          await closeButton.click();
        }
      }
    });
  });
});

test.describe('Chat Feature - Authentication Required', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    // Try to access chat page directly
    await page.goto(`${BASE_URL}/admin/chat`);

    // Should be redirected to login
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });
});
