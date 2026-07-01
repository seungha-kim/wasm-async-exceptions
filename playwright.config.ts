import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  use: {
    channel: 'chrome',
    baseURL: 'http://localhost:8080',
  },
  webServer: {
    command: 'npm run serve',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});