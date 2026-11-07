import { defineConfig } from '@playwright/test';

// Set PW_CHROMIUM to use an already-installed Chromium instead of Playwright's own download.
const launchOptions = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:5191', launchOptions },
  webServer: { command: 'npx vite --port 5191 --strictPort', url: 'http://localhost:5191', reuseExistingServer: true },
  projects: [
    { name: 'phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } },
  ],
});
