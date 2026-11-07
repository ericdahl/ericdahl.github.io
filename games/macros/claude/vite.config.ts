import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // repo timestamps carry a UTC offset; pin the zone so tests don't depend on the machine's
    env: { TZ: 'America/Los_Angeles' },
  },
});
