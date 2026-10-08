import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  failOnFlakyTests: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : 2,
  timeout: 30_000,
  expect: { timeout: 10_000, toHaveScreenshot: { animations: 'disabled', maxDiffPixels: 0 } },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: './test-results',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  // Missing references must fail; only the explicit update command creates them.
  updateSnapshots: 'none',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:4321',
    viewport: { width: 1280, height: 960 },
    locale: 'en-US',
    timezoneId: 'UTC',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testIgnore: '**/*.visual.spec.ts', use: { reducedMotion: 'no-preference' } },
    { name: 'chromium-reduced', testIgnore: '**/*.visual.spec.ts', use: { reducedMotion: 'reduce' } },
    { name: 'visual', testMatch: '**/*.visual.spec.ts', use: { reducedMotion: 'reduce' } },
  ],
  webServer: {
    command: 'node scripts/serve-test-site.mjs',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
