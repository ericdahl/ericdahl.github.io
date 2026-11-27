import { defineConfig } from '@playwright/test';

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: { baseURL: 'http://localhost:5182', launchOptions: { executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } },
  webServer: { command: 'npx vite --port 5182 --strictPort', url: 'http://localhost:5182', reuseExistingServer: true },
  projects: [{ name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } } }],
});
