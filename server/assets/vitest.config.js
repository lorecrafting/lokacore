import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['js/hooks/**/*.js'],
      exclude: ['js/hooks/__tests__/**'],
      reporter: ['text', 'text-summary'],
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 55
      }
    }
  }
})
