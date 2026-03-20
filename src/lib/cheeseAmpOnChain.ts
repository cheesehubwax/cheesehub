/**
 * On-Chain Playlist Storage for CHEESEAmp
 *
 * Saves/loads playlists to the WAX blockchain via the cheeseamphub contract.
 * User pays RAM (~550 bytes per 50-track playlist ≈ 0.03–0.06 WAX).
 * RAM is reclaimed when the playlist is deleted.
 */
import type { Session } from '@wharfkit/session';
import { getTransactPlugins } from './wharfKit';
import { fetchTableRows } from './waxRpcFallback';
import { logger } from './logger';

/** Set to true once the saveplaylist/delplaylist actions are deployed on cheeseamphub */
export const ONCHAIN_PLAYLISTS_ENABLED = false;

const CONTRACT = 'cheeseamphub';
const TABLE = 'playlists';

export interface OnChainPlaylist {
  playlist_name: string;
  asset_ids: string[]; // uint64 stored as string from RPC
}

/**
 * Fetch all on-chain playlists for a given account.
 * Free — just an RPC table read.
 */
export async function fetchOnChainPlaylists(accountName: string): Promise<OnChainPlaylist[]> {
  if (!ONCHAIN_PLAYLISTS_ENABLED) return [];

  try {
    const result = await fetchTableRows<OnChainPlaylist>({
      code: CONTRACT,
      scope: accountName,
      table: TABLE,
      limit: 100,
    });
    logger.info(`[OnChain] Fetched ${result.rows.length} playlists for ${accountName}`);
    return result.rows;
  } catch (error) {
    logger.warn('[OnChain] Failed to fetch playlists:', error);
    return [];
  }
}

/**
 * Save a playlist on-chain. User pays RAM.
 * If a playlist with the same name exists, it will be overwritten by the contract.
 */
export async function savePlaylistOnChain(
  session: Session,
  playlistName: string,
  assetIds: string[]
): Promise<{ success: boolean; txId: string | null }> {
  const accountName = String(session.actor);

  const actions = [
    {
      account: CONTRACT,
      name: 'saveplaylist',
      authorization: [{ actor: accountName, permission: 'active' }],
      data: {
        user: accountName,
        playlist_name: playlistName,
        asset_ids: assetIds.map(id => Number(id)),
      },
    },
  ];

  try {
    const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
    const txId = result.resolved?.transaction.id?.toString() || null;
    logger.info(`[OnChain] Saved playlist "${playlistName}" — tx: ${txId}`);
    return { success: true, txId };
  } catch (error) {
    logger.error('[OnChain] Save playlist failed:', error);
    throw error;
  }
}

/**
 * Delete a playlist from chain. Reclaims RAM for the user.
 */
export async function deletePlaylistOnChain(
  session: Session,
  playlistName: string
): Promise<{ success: boolean; txId: string | null }> {
  const accountName = String(session.actor);

  const actions = [
    {
      account: CONTRACT,
      name: 'delplaylist',
      authorization: [{ actor: accountName, permission: 'active' }],
      data: {
        user: accountName,
        playlist_name: playlistName,
      },
    },
  ];

  try {
    const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
    const txId = result.resolved?.transaction.id?.toString() || null;
    logger.info(`[OnChain] Deleted playlist "${playlistName}" — tx: ${txId}`);
    return { success: true, txId };
  } catch (error) {
    logger.error('[OnChain] Delete playlist failed:', error);
    throw error;
  }
}
