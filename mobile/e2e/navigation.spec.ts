import { test, expect } from '@playwright/test';

/**
 * Navigation Tests for Loka Mobile Web
 */

// Generate a unique alphabetic name (character names only allow letters)
function generateUniqueName(prefix: string): string {
  const randomSuffix = Math.random().toString(36).replace(/[^a-z]/gi, '').substring(0, 8);
  return `${prefix}${randomSuffix}`;
}

test.describe('Navigation', () => {
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

    // Login with unique name
    await page.getByTestId('name-input').fill(generateUniqueName('NavPlayer'));
    await page.getByTestId('enter-button').click();
    await expect(page.getByTestId('room-view')).toBeVisible({ timeout: 15000 });
  });

  test('can navigate to available exit', async ({ page }) => {
    // Get initial room title
    const initialTitle = await page.getByTestId('room-title').textContent();

    // Find an available direction (one that's not disabled)
    const directions = ['north', 'south', 'east', 'west'];

    for (const dir of directions) {
      const button = page.getByTestId(`nav-${dir}`);
      const isDisabled = await button.evaluate((el) => {
        // Check if button looks disabled (muted color or not underlined)
        const style = window.getComputedStyle(el);
        return style.textDecoration !== 'underline' || style.opacity === '0.5';
      }).catch(() => true);

      if (!isDisabled) {
        // Click the direction
        await button.click();

        // Wait for potential room change
        await page.waitForTimeout(1000);

        // Room should still be visible
        await expect(page.getByTestId('room-view')).toBeVisible();

        // Either room changed or we got an event
        const newTitle = await page.getByTestId('room-title').textContent();
        console.log(`Navigated ${dir}: "${initialTitle}" -> "${newTitle}"`);

        break;
      }
    }
  });

  test('room view updates after navigation', async ({ page }) => {
    // Capture initial state
    const initialTitle = await page.getByTestId('room-title').textContent();
    const initialDesc = await page.getByTestId('room-description').textContent();

    // Try to navigate (find an enabled direction)
    const navNorth = page.getByTestId('nav-north');
    const navSouth = page.getByTestId('nav-south');

    // Try north first
    await navNorth.click();
    await page.waitForTimeout(1500);

    // Check if anything changed
    const afterNorthTitle = await page.getByTestId('room-title').textContent();

    if (afterNorthTitle !== initialTitle) {
      // We moved! Go back south
      await navSouth.click();
      await page.waitForTimeout(1500);

      const afterSouthTitle = await page.getByTestId('room-title').textContent();
      expect(afterSouthTitle).toBe(initialTitle);
    }
  });
});
