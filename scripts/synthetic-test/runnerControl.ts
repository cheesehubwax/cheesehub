import { closeSync, existsSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

/** Exclusive local ownership; stale locks require inspection, never automatic deletion. */
export function acquireRunnerControl(configPath: string) {
  const lockPath = resolve(configPath) + '.runner.lock';
  const stopPath = lockPath + '.stop';
  const token = randomUUID();
  let fd: number;
  try { fd = openSync(lockPath, 'wx', 0o600); }
  catch { throw new Error('Runner lock exists; a copy may already be running. Check before removing the .runner.lock file.'); }
  try { writeFileSync(fd, JSON.stringify({ pid: process.pid, token, started: new Date().toISOString() })); }
  catch (error) { closeSync(fd); unlinkSync(lockPath); throw error; }
  closeSync(fd);
  const stopRequested = () => {
    if (!existsSync(stopPath)) return false;
    // An old request must never stop a newly started process.
    return readFileSync(stopPath, 'utf8').trim() === token;
  };
  const release = () => {
    if (!existsSync(lockPath)) return;
    if (JSON.parse(readFileSync(lockPath, 'utf8')).token !== token) return;
    if (existsSync(stopPath)) unlinkSync(stopPath);
    unlinkSync(lockPath);
  };
  return { lockPath, stopPath, stopRequested, release };
}