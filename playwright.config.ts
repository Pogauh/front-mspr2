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
    // Uses .env.e2e which sets VITE_MOCK=true (runs on 5174 to avoid conflict with dev server on 5173)
    command: 'npm run dev:e2e',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    // .env.e2e is git-ignored (.env*) so it does not exist in CI: pass the mock settings explicitly
    env: { VITE_MOCK: 'true', VITE_API_BASE_URL: '/api-siege' },
  },
})
