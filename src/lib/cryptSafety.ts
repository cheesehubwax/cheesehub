/**
 * CHEESECrypt safety numbers (Signal-style). Each side's 30 digits come from 5200 rounds of SHA-512 over
 * version || public key || account; the two halves are ordered by account so both people see the same 60 digits.
 * Nothing here touches the chain. Verified marks live only in this browser, keyed by account + exact public key,
 * so a changed key silently drops the mark and the chat can warn.
 */
import nacl from 'tweetnacl';
import { decodeBase64 } from 'tweetnacl-util';

const ITERATIONS = 5200;
const VERSION = new Uint8Array([0, 1]);

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** 30 digits for one (account, public key). */
export function fingerprintDigits(account: string, publicKey: string): string {
  const key = decodeBase64(publicKey);
  const id = new TextEncoder().encode(account);
  let hash = nacl.hash(concat(VERSION, key, id));
  for (let i = 1; i < ITERATIONS; i++) hash = nacl.hash(concat(hash, key));
  let digits = '';
  for (let c = 0; c < 6; c++) {
    let n = 0;
    for (let b = 0; b < 5; b++) n = n * 256 + hash[c * 5 + b];
    digits += String(n % 100000).padStart(5, '0');
  }
  return digits;
}

/** 60-digit safety number, identical for both parties. */
export function safetyNumber(a: { account: string; publicKey: string }, b: { account: string; publicKey: string }): string {
  const [x, y] = a.account <= b.account ? [a, b] : [b, a];
  return fingerprintDigits(x.account, x.publicKey) + fingerprintDigits(y.account, y.publicKey);
}

/** 12 groups of 5 digits. */
export const safetyGroups = (n: string) => n.match(/\d{5}/g) ?? [];

const store = (account: string) => `cheesecrypt-verified-${account}`;

export function loadVerified(account: string): Record<string, string> {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(store(account)) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'));
  } catch { return {}; }
}

export function setVerified(account: string, partner: string, publicKey: string | null): Record<string, string> {
  const next = { ...loadVerified(account) };
  if (publicKey) next[partner] = publicKey; else delete next[partner];
  localStorage.setItem(store(account), JSON.stringify(next));
  return next;
}

export type VerifyState = 'verified' | 'changed' | 'unverified';
export function verifyState(verified: Record<string, string>, partner: string, currentKey: string | undefined): VerifyState {
  const saved = verified[partner];
  if (!saved || !currentKey) return 'unverified';
  return saved === currentKey ? 'verified' : 'changed';
}
