import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Loka Mobile Web E2E Tests
 *
 * Tests the React Native Web version of the app running at localhost:8081
 */
export default defineConfig({
  testDir: './e2e',

  // Run tests in parallel
  fullyParallel: true,

  // Fail fast in CI
  forbidOnly: !!process.env.CI,

  // Retry on failure
  retries: process.env.CI ? 2 : 0,

  // Limit workers in CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  // Shared settings
  use: {
    // Base URL for the Expo web app
    baseURL: 'http://localhost:8081',

    // Collect trace on failure
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',
  },

  // Test timeout
  timeout: 30000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Configure projects for different viewports
  // Note: Safari/WebKit requires additional setup (npx playwright install webkit)
  projects: [
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  // Web server - start Expo if not running
  webServer: {
    command: 'npm run web',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 60000,
  },
});
