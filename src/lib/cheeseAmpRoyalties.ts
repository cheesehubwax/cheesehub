/**
 * CHEESEAmp Royalty Play Logging
 *
 * Dual-mode play tracking:
 * - Anchor: fire-and-forget single `logplay` via session keys
 * - Cloud Wallet: buffer plays in localStorage, flush as batch `logplays`
 * DISABLED until cheeseamphub contract is live.
 */
import type { Session } from '@wharfkit/session';
import { isAnchorSession, getTransactPlugins } from './wharfKit';
import { logger } from './logger';

/** Flip to true when the cheeseamphub contract is deployed */
const ROYALTIES_ENABLED = false;

const CHEESEAMPHUB_CONTRACT = 'cheeseamphub';
const BUFFER_KEY_PREFIX = 'cheesehub_playbuffer_';

interface BufferedPlay {
  templateId: number;
  timestamp: number;
}

// ---- Anchor: immediate single-play logging ----

/**
 * Fire-and-forget logplay transaction for Anchor sessions.
 * Session keys allow auto-signing after initial approval.
 */
export async function logPlayImmediate(session: Session, templateId: number): Promise<void> {
  try {
    await session.transact({
      action: {
        account: CHEESEAMPHUB_CONTRACT,
        name: 'logplay',
        authorization: [session.permissionLevel],
        data: {
          caller: String(session.actor),
          template_id: templateId,
        },
      },
    }, {
      transactPlugins: getTransactPlugins(session),
    });
    logger.info(`[CHEESEAmp] Logged play for template ${templateId}`);
  } catch (error: any) {
    // Silently handle cooldown errors — expected if user replays within 5 min
    if (error?.message?.includes('cooldown')) {
      logger.info(`[CHEESEAmp] Play cooldown active for template ${templateId}`);
    } else {
      logger.warn(`[CHEESEAmp] Failed to log play:`, error);
    }
  }
}

// ---- Cloud Wallet: localStorage buffer ----

function getBufferKey(accountName: string): string {
  return `${BUFFER_KEY_PREFIX}${accountName}`;
}

function loadBuffer(accountName: string): BufferedPlay[] {
  try {
    const raw = localStorage.getItem(getBufferKey(accountName));
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.plays) ? parsed.plays : [];
    }
  } catch {
    // Ignore parse errors
  }
  return [];
}

function saveBuffer(accountName: string, plays: BufferedPlay[]): void {
  localStorage.setItem(getBufferKey(accountName), JSON.stringify({ plays }));
}

/**
 * Buffer a play in localStorage for later batch submission.
 * Applies a client-side 5-minute cooldown per template to avoid wasted entries.
 */
export function bufferPlay(accountName: string, templateId: number): void {
  const plays = loadBuffer(accountName);
  const now = Date.now();

  // Client-side cooldown: skip if same template was buffered within 5 minutes
  const recentDuplicate = plays.find(
    p => p.templateId === templateId && (now - p.timestamp) < 5 * 60 * 1000
  );
  if (recentDuplicate) {
    logger.info(`[CHEESEAmp] Buffer cooldown: template ${templateId} already buffered recently`);
    return;
  }

  plays.push({ templateId, timestamp: now });
  saveBuffer(accountName, plays);
  logger.info(`[CHEESEAmp] Buffered play for template ${templateId} (${plays.length} total)`);
}

/**
 * Get number of buffered plays for UI display.
 */
export function getBufferedPlayCount(accountName: string): number {
  return loadBuffer(accountName).length;
}

/**
 * Flush the play buffer by sending a batch `logplays` transaction.
 * Called during natural signing moments (e.g., opening wallet).
 * Returns true if a transaction was sent.
 */
export async function flushPlayBuffer(session: Session, accountName: string): Promise<boolean> {
  const plays = loadBuffer(accountName);
  if (plays.length === 0) return false;

  // Extract unique template IDs (contract handles its own cooldown)
  const templateIds = plays.map(p => p.templateId);

  try {
    await session.transact({
      action: {
        account: CHEESEAMPHUB_CONTRACT,
        name: 'logplays',
        authorization: [session.permissionLevel],
        data: {
          caller: String(session.actor),
          template_ids: templateIds,
        },
      },
    }, {
      transactPlugins: getTransactPlugins(session),
    });

    // Clear buffer on success
    saveBuffer(accountName, []);
    logger.info(`[CHEESEAmp] Flushed ${templateIds.length} buffered plays`);
    return true;
  } catch (error: any) {
    logger.warn(`[CHEESEAmp] Failed to flush play buffer:`, error);
    // Don't clear buffer on failure — will retry next time
    return false;
  }
}

/**
 * Determine the correct play logging method and call it.
 * For Anchor: immediate fire-and-forget.
 * For Cloud Wallet: buffer locally.
 */
export function logPlay(session: Session, accountName: string, templateId: number): void {
  if (isAnchorSession(session)) {
    // Fire-and-forget — don't await
    logPlayImmediate(session, templateId).catch(() => {});
  } else {
    bufferPlay(accountName, templateId);
  }
}