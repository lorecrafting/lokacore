import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['js/world_builder/**/*.js'],
      exclude: ['js/world_builder/__tests__/**'],
      reporter: ['text', 'text-summary'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50
      }
    }
  }
})
