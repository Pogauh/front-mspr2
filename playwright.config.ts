import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Mock state is in-process - run sequentially to avoid cross-test pollution
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Local: dev server on 5174 (no conflict with the dev server on 5173).
    // CI: build once and serve the static bundle - much faster than the dev server,
    // which compiles every page on first request.
    command: process.env.CI
      ? 'npm run build-only && npm run preview -- --port 5174 --strictPort'
      : 'npm run dev:e2e',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // .env.e2e is git-ignored (.env*) so it does not exist in CI: pass the mock settings explicitly
    env: { VITE_MOCK: 'true', VITE_API_BASE_URL: '/api-siege' },
  },
})
