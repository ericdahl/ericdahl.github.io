import { defineConfig } from 'vitest/config';

// `npm run balance`: the bot's balance report (tests/balance.report.ts), kept out of the ordinary test run.
export default defineConfig({
  test: { include: ['tests/balance.report.ts'], environment: 'node' },
});
