import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('downloaded Nightcrawler sources match the tested standalone runner and exclude private/daytime files', () => {
  const dest = join(import.meta.dir, '../../public/downloads/nightcrawler');
  const manifest = JSON.parse(readFileSync(join(dest, 'manifest.json'), 'utf8')) as string[];
  expect(manifest).toEqual(['night.ts', 'policy.ts', 'runtime.ts', 'nightState.ts', 'bun.lock', 'night-config.example.json', 'package.json', 'README.md']);
  for (const name of ['night.ts', 'policy.ts', 'runtime.ts', 'nightState.ts', 'bun.lock', 'night-config.example.json']) {
    expect(readFileSync(join(dest, name), 'utf8')).toBe(readFileSync(join(import.meta.dir, name), 'utf8'));
  }
  const pkg = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8'));
  expect(pkg.scripts.start).toBe('bun run night.ts night-config.json');
  expect(pkg.scripts.check).toBe('bun run night.ts night-config.json --dry-run');
});