import { test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireRunnerControl } from './runnerControl';

test('one live owner per config; matching stop token only; release preserves counters', () => {
  const dir = mkdtempSync(join(tmpdir(), 'runner-control-'));
  try {
    const config = join(dir, 'config.json');
    const counters = join(dir, 'config.state.json');
    writeFileSync(counters, '{"sent":7}');
    const owner = acquireRunnerControl(config);
    expect(() => acquireRunnerControl(config)).toThrow('Runner lock exists');
    writeFileSync(owner.stopPath, 'old-token');
    expect(owner.stopRequested()).toBe(false);
    const { token } = JSON.parse(readFileSync(owner.lockPath, 'utf8'));
    writeFileSync(owner.stopPath, token);
    expect(owner.stopRequested()).toBe(true);
    owner.release();
    expect(existsSync(owner.lockPath)).toBe(false);
    expect(readFileSync(counters, 'utf8')).toBe('{"sent":7}');
    acquireRunnerControl(config).release();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('stale lock is never automatically removed or stolen', () => {
  const dir = mkdtempSync(join(tmpdir(), 'runner-stale-'));
  try {
    const config = join(dir, 'config.json');
    writeFileSync(config + '.runner.lock', '{"pid":999999,"token":"stale"}');
    expect(() => acquireRunnerControl(config)).toThrow('Runner lock exists');
    expect(JSON.parse(readFileSync(config + '.runner.lock', 'utf8')).token).toBe('stale');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});