/** Isolated Olm prototype. No wallet, transport, persistence, or production send path. */
import type { Account, Session } from '@kinsh/vodozemac-wasm';

export const SECRET_CHAT_LIVE = false;
export const SECRET_ENGINE_VERSION = 'vodozemac-wasm-0.4.2-olm-v1';
export const SECRET_TEXT_MAX_BYTES = 2048;

type Engine = { Account: typeof Account; Session: typeof Session };
let enginePromise: Promise<Engine> | undefined;

/** Lazy loading keeps ordinary chats independent of WASM availability. */
export function loadSecretEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = import('@kinsh/vodozemac-wasm').then(async module => {
      if ('default' in module && typeof module.default === 'function') await module.default();
      return module;
    }).catch(error => { enginePromise = undefined; throw error; });
  }
  return enginePromise;
}

export interface SecretPrototypeIdentity {
  /** Secret serialization: session memory only until an encrypted transactional store exists. */
  accountState: string;
  identityKey: string;
  oneTimeKey: string;
}
export interface SecretCiphertext { type: 0 | 1; body: string }
export interface SecretTransition { sessionState: string; ciphertext: SecretCiphertext }

/** Independently random identity and prekey; never derived from an ordinary messaging key. */
export async function createSecretPrototypeIdentity(): Promise<SecretPrototypeIdentity> {
  const engine = await loadSecretEngine();
  const account = new engine.Account();
  try {
    account.generateOneTimeKeys(1);
    const identityKey: unknown = JSON.parse(account.identityKeys()).curve25519;
    const oneTimeKey: unknown = Object.values(JSON.parse(account.oneTimeKeys()).curve25519)[0];
    if (typeof identityKey !== 'string' || typeof oneTimeKey !== 'string') throw new Error('Secret Chat key generation failed');
    account.markKeysAsPublished();
    return { accountState: account.pickle(), identityKey, oneTimeKey };
  } finally { account.free(); }
}

/** Prototype bundles MUST be account-authenticated and consented to before any live use. */
export async function createSecretPrototypeSession(accountState: string, peer: Pick<SecretPrototypeIdentity, 'identityKey' | 'oneTimeKey'>): Promise<string> {
  const engine = await loadSecretEngine();
  const account = engine.Account.fromPickle(accountState);
  try {
    const session = account.createOutboundSession(peer.identityKey, peer.oneTimeKey);
    try { return session.pickle(); } finally { session.free(); }
  } finally { account.free(); }
}

function parseCiphertext(raw: string): SecretCiphertext {
  const value = JSON.parse(raw);
  if ((value?.type !== 0 && value?.type !== 1) || typeof value.body !== 'string' || !value.body) throw new Error('Invalid Secret Chat ciphertext');
  return { type: value.type, body: value.body };
}

/** Clone/advance: caller must commit state AND exact ciphertext atomically before broadcasting. */
export async function advanceSecretPrototypeSend(sessionState: string, text: string): Promise<SecretTransition> {
  if (!text || new TextEncoder().encode(text).length > SECRET_TEXT_MAX_BYTES) throw new Error('Invalid Secret Chat text size');
  const engine = await loadSecretEngine();
  const session = engine.Session.fromPickle(sessionState);
  try { return { ciphertext: parseCiphertext(session.encrypt(text)), sessionState: session.pickle() }; }
  finally { session.free(); }
}

/** Expected identity comes from the authenticated bundle, NOT the message itself. */
export async function acceptSecretPrototypeSession(accountState: string, ciphertext: SecretCiphertext, expectedIdentity: string) {
  if (ciphertext.type !== 0) throw new Error('Secret Chat requires an initial prekey message');
  const engine = await loadSecretEngine();
  const account = engine.Account.fromPickle(accountState);
  try {
    const result = account.createInboundSession(ciphertext.body);
    try {
      if (result.senderIdentityKey !== expectedIdentity) throw new Error('Secret Chat sender identity changed');
      const session = result.takeSession();
      try { return { text: result.plaintext, sessionState: session.pickle(), accountState: account.pickle() }; }
      finally { session.free(); }
    } finally { result.free(); }
  } finally { account.free(); }
}

/** Failed authentication leaves the caller's state untouched; commit success before displaying. */
export async function advanceSecretPrototypeReceive(sessionState: string, ciphertext: SecretCiphertext) {
  const engine = await loadSecretEngine();
  const session = engine.Session.fromPickle(sessionState);
  try {
    const text = session.decrypt(ciphertext.type, ciphertext.body);
    return { text, sessionState: session.pickle() };
  } finally { session.free(); }
}