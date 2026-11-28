import { test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('actual entry point drains local in-flight work and releases its lock after a stop request', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'runner-lifecycle-'));
  let child: ReturnType<typeof Bun.spawn> | undefined;
  try {
    const source = readFileSync(join(import.meta.dir, 'run.ts'), 'utf8')
      .replace("from './policy'", `from '${join(import.meta.dir, 'policy.ts')}'`)
      .replace("from './runnerControl'", `from '${join(import.meta.dir, 'runnerControl.ts')}'`);
    writeFileSync(join(dir, 'run.ts'), source);
    writeFileSync(join(dir, 'runtime.ts'), `
      import { writeFileSync } from 'node:fs';
      export const log = console.log;
      export const rand = () => 0;
      export function createRuntime(config, statePath) {
        let completed = 0;
        return {
          botNames: config.bots.map(b => b.account),
          preflight: async () => console.log('fixture-ready'),
          send: async () => { console.log('fixture-in-flight'); await Bun.sleep(1500); completed++; console.log('fixture-completed'); },
          saveState: () => writeFileSync(statePath, JSON.stringify({ completed })),
          getState: () => ({ bursts: [] })
        };
      }
    `);
    const config = JSON.parse(readFileSync(join(import.meta.dir, 'config.example.json'), 'utf8'));
    config.trickleRatePerHour = 6;
    config.maxBurstsPerHour = 0;
    writeFileSync(join(dir, 'config.json'), JSON.stringify(config));
    child = Bun.spawn([process.execPath, 'run.ts'], { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
    const output: string[] = [];
    const collect = (async () => { for await (const chunk of child.stdout) output.push(Buffer.from(chunk).toString()); })();
    const deadline = Date.now() + 5000;
    while (!output.join('').includes('fixture-in-flight') && Date.now() < deadline) await Bun.sleep(20);
    expect(output.join('')).toContain('fixture-in-flight');
    const lockPath = join(dir, 'config.json.runner.lock');
    const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
    writeFileSync(lockPath + '.stop', lock.token);
    expect(await child.exited).toBe(0);
    await collect;
    const log = output.join('');
    expect(log.indexOf('fixture-completed')).toBeLessThan(log.lastIndexOf('stopped'));
    expect(JSON.parse(readFileSync(join(dir, 'config.state.json'), 'utf8')).completed).toBe(2);
    expect(existsSync(lockPath)).toBe(false);
    expect(existsSync(lockPath + '.stop')).toBe(false);
  } finally { child?.kill(); rmSync(dir, { recursive: true, force: true }); }
}, 10000);