import { it, expect } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { CHANGELOG } from '../src/changelog';

it('the newest changelog entry matches package.json', () => {
  expect(CHANGELOG[0].version).toBe(pkg.version);
  expect(new Set(CHANGELOG.map((r) => r.version)).size).toBe(CHANGELOG.length);
});
