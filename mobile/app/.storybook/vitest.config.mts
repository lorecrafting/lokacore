// The Storybook smoke (npm run storybook:smoke): every story renders in headless Chromium, its play
// function and the a11y checks pass. Kept in .storybook so the app's tsconfig (no Node types) skips it.
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  root: `${import.meta.dirname}/..`,
  plugins: [storybookTest({ configDir: import.meta.dirname })],
  test: {
    name: 'storybook',
    // One story file at a time: the page turn's picture has motion.quick (160 ms) to be taken, and on
    // a 4-vCPU runner other files' renders and axe runs beside it starved it (book-e2e 37912419292).
    fileParallelism: false,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
});
