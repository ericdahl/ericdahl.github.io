import { expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { CHANGELOG } from '../src/changelog';

it('the changelog has an entry for the current version', () => {
  expect(CHANGELOG[0].version).toBe(pkg.version);
});
