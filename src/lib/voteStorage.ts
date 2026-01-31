import { logger } from "./logger";

// Type definition to avoid circular dependency with dao.ts
export interface UserVote {
  choice_index: number;
  weight: number;
  rankings?: number[];
}

const STORAGE_KEY_PREFIX = "dao_votes_";

interface StoredVote extends UserVote {
  votedAt: string;
}

interface VoteStorage {
  [daoProposalKey: string]: StoredVote;
}

function getStorageKey(accountName: string): string {
  return `${STORAGE_KEY_PREFIX}${accountName}`;
}

function createDaoProposalKey(daoName: string, proposalId: number): string {
  return `${daoName}_${proposalId}`;
}

export function saveVote(
  accountName: string,
  daoName: string,
  proposalId: number,
  vote: UserVote
): void {
  if (!accountName) return;

  try {
    const storageKey = getStorageKey(accountName);
    const existing = localStorage.getItem(storageKey);
    const storage: VoteStorage = existing ? JSON.parse(existing) : {};

    const daoProposalKey = createDaoProposalKey(daoName, proposalId);
    storage[daoProposalKey] = {
      ...vote,
      votedAt: new Date().toISOString(),
    };

    localStorage.setItem(storageKey, JSON.stringify(storage));
    logger.debug("Vote saved to localStorage:", { accountName, daoName, proposalId, vote });
  } catch (error) {
    logger.error("Failed to save vote to localStorage:", error);
  }
}

export function getVote(
  accountName: string,
  daoName: string,
  proposalId: number
): UserVote | null {
  if (!accountName) return null;

  try {
    const storageKey = getStorageKey(accountName);
    const existing = localStorage.getItem(storageKey);
    if (!existing) return null;

    const storage: VoteStorage = JSON.parse(existing);
    const daoProposalKey = createDaoProposalKey(daoName, proposalId);
    const storedVote = storage[daoProposalKey];

    if (storedVote) {
      // Return without the votedAt field to match UserVote interface
      const { votedAt, ...vote } = storedVote;
      return vote;
    }

    return null;
  } catch (error) {
    console.error("Failed to get vote from localStorage:", error);
    return null;
  }
}

export function getAllVotes(accountName: string): Record<string, UserVote> {
  if (!accountName) return {};

  try {
    const storageKey = getStorageKey(accountName);
    const existing = localStorage.getItem(storageKey);
    if (!existing) return {};

    const storage: VoteStorage = JSON.parse(existing);
    const votes: Record<string, UserVote> = {};

    for (const [key, storedVote] of Object.entries(storage)) {
      const { votedAt, ...vote } = storedVote;
      votes[key] = vote;
    }

    return votes;
  } catch (error) {
    console.error("Failed to get all votes from localStorage:", error);
    return {};
  }
}

export function getVotesForDao(
  accountName: string,
  daoName: string
): Record<number, UserVote> {
  if (!accountName) return {};

  try {
    const storageKey = getStorageKey(accountName);
    const existing = localStorage.getItem(storageKey);
    if (!existing) return {};

    const storage: VoteStorage = JSON.parse(existing);
    const votes: Record<number, UserVote> = {};

    for (const [key, storedVote] of Object.entries(storage)) {
      if (key.startsWith(`${daoName}_`)) {
        const proposalId = parseInt(key.replace(`${daoName}_`, ""), 10);
        if (!isNaN(proposalId)) {
          const { votedAt, ...vote } = storedVote;
          votes[proposalId] = vote;
        }
      }
    }

    return votes;
  } catch (error) {
    console.error("Failed to get votes for DAO from localStorage:", error);
    return {};
  }
}

export function clearVotes(accountName: string): void {
  if (!accountName) return;

  try {
    const storageKey = getStorageKey(accountName);
    localStorage.removeItem(storageKey);
    logger.debug("Cleared votes from localStorage for:", accountName);
  } catch (error) {
    logger.error("Failed to clear votes from localStorage:", error);
  }
}
