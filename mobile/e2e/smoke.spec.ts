import { test, expect } from '@playwright/test';

/**
 * Smoke Tests for Loka Mobile Web
 *
 * Tests the critical user flows against the React Native Web version
 * running at localhost:8081 with a real Phoenix backend at localhost:4000
 */

// Generate a unique alphabetic name (character names only allow letters)
function generateUniqueName(prefix: string): string {
  const randomSuffix = Math.random().toString(36).replace(/[^a-z]/gi, '').substring(0, 8);
  return `${prefix}${randomSuffix}`;
}

test.describe('Smoke Tests', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear cookies at context level (before navigation)
    await context.clearCookies();

    // Navigate first, then clear storage
    await page.goto('/');

    // Clear storage after page loads
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Ignore if storage is not available
      }
    });

    // Reload to apply cleared state
    await page.reload();
  });

  test('welcome screen loads', async ({ page }) => {
    await page.goto('/');

    // Should see the title
    await expect(page.getByText('Loka')).toBeVisible();
    await expect(page.getByText('A Living Story')).toBeVisible();

    // Should see the name prompt
    await expect(page.getByText('What shall we call you?')).toBeVisible();

    // Should see name input and enter button
    await expect(page.getByTestId('name-input')).toBeVisible();
    await expect(page.getByTestId('enter-button')).toBeVisible();
  });

  test('guest login flow', async ({ page }) => {
    await page.goto('/');

    // Enter a name (letters only for character name sanitization)
    const testName = generateUniqueName('TestPlayer');
    await page.getByTestId('name-input').fill(testName);

    // Click enter
    await page.getByTestId('enter-button').click();

    // Wait for game to load (should see room view)
    await expect(page.getByTestId('room-view')).toBeVisible({ timeout: 15000 });

    // Should see room title
    await expect(page.getByTestId('room-title')).toBeVisible();

    // Should see bottom bar with navigation
    await expect(page.getByTestId('bottom-bar')).toBeVisible();
  });

  test('navigation controls visible after login', async ({ page }) => {
    await page.goto('/');

    // Quick login
    await page.getByTestId('name-input').fill(generateUniqueName('NavTest'));
    await page.getByTestId('enter-button').click();

    // Wait for game
    await expect(page.getByTestId('room-view')).toBeVisible({ timeout: 15000 });

    // Check navigation buttons exist (they may be enabled or disabled based on exits)
    await expect(page.getByTestId('nav-north')).toBeVisible();
    await expect(page.getByTestId('nav-south')).toBeVisible();
    await expect(page.getByTestId('nav-east')).toBeVisible();
    await expect(page.getByTestId('nav-west')).toBeVisible();
  });

  test('chat modal opens', async ({ page }) => {
    await page.goto('/');

    // Quick login
    await page.getByTestId('name-input').fill(generateUniqueName('ChatTest'));
    await page.getByTestId('enter-button').click();

    // Wait for game
    await expect(page.getByTestId('room-view')).toBeVisible({ timeout: 15000 });

    // Click Say button to open chat
    await page.getByTestId('chat-say-button').click();

    // Chat modal should open
    await expect(page.getByTestId('chat-modal')).toBeVisible();
    await expect(page.getByTestId('chat-input')).toBeVisible();
    await expect(page.getByTestId('chat-send-button')).toBeVisible();

    // Cancel should close it
    await page.getByTestId('chat-cancel-button').click();
    await expect(page.getByTestId('chat-modal')).not.toBeVisible();
  });

  test('menu panel opens', async ({ page }) => {
    await page.goto('/');

    // Quick login
    await page.getByTestId('name-input').fill(generateUniqueName('MenuTest'));
    await page.getByTestId('enter-button').click();

    // Wait for game
    await expect(page.getByTestId('room-view')).toBeVisible({ timeout: 15000 });

    // Click menu button (vitals area)
    await page.getByTestId('menu-button').click();

    // Menu panel should open
    await expect(page.getByTestId('menu-panel')).toBeVisible();

    // Should see tabs (using testIDs for precision)
    await expect(page.getByTestId('menu-tab-character')).toBeVisible();
    await expect(page.getByTestId('menu-tab-inventory')).toBeVisible();
    await expect(page.getByTestId('menu-tab-quest')).toBeVisible();

    // Close menu
    await page.getByTestId('close-menu').click();
    await expect(page.getByTestId('menu-panel')).not.toBeVisible();
  });
});
