// The Storybook smoke (npm run storybook:smoke): every story renders in headless Chromium, its play
// function and the a11y checks pass. Here, not in .storybook, because the Storybook test panel and
// MCP test-run look for it beside .storybook; .storybook/tsconfig.json type-checks it (Node types).
import { defineConfig } from 'vitest/config';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [storybookTest({ configDir: `${import.meta.dirname}/.storybook` })],
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
