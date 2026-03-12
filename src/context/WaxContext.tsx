import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Session, SerializedSession } from '@wharfkit/session';
import { sessionKit, closeWharfkitModals, setLoginInProgress, getTransactPlugins } from '@/lib/wharfKit';
import { CHEESE_CONFIG, WAX_CHAIN, NFTHIVE_CONFIG } from '@/lib/waxConfig';
import { useToast } from '@/hooks/use-toast';

interface WaxContextType {
  session: Session | null;
  isConnected: boolean;
  isLoading: boolean;
  accountName: string | null;
  cheeseBalance: number;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  transferCheese: (amount: number, memo: string) => Promise<string | null>;
  transferToken: (
    tokenContract: string,
    tokenSymbol: string,
    precision: number,
    to: string,
    amount: number,
    memo: string
  ) => Promise<string | null>;
  transferNFTs: (to: string, assetIds: string[], memo: string) => Promise<string | null>;
  burnNFTs: (assetIds: string[]) => Promise<string | null>;
  claimDrop: (
    dropId: string,
    quantity: number,
    listingPrice: string,
    tokenContract: string,
    tokenSymbol: string,
    precision: number
  ) => Promise<string | null>;
  claimFreeDrop: (dropId: string, quantity: number) => Promise<string | null>;
  joinDao: (daoName: string) => Promise<string | null>;
  leaveDao: (daoName: string) => Promise<string | null>;
  // Multi-account support
  allSessions: SerializedSession[];
  switchAccount: (session: SerializedSession) => Promise<void>;
  addAccount: () => Promise<void>;
  removeAccount: (session: SerializedSession) => Promise<void>;
  refreshSessions: () => Promise<void>;
}

const WaxContext = createContext<WaxContextType | undefined>(undefined);

export function WaxProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cheeseBalance, setCheeseBalance] = useState(0);
  const [allSessions, setAllSessions] = useState<SerializedSession[]>([]);
  const { toast } = useToast();

  const accountName = session?.actor?.toString() || null;
  const isConnected = !!session;

  const refreshBalance = useCallback(async () => {
    if (!session) {
      setCheeseBalance(0);
      return;
    }

    const endpoints = WAX_CHAIN.rpcUrls || [WAX_CHAIN.url];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(
          `${endpoint}/v1/chain/get_currency_balance`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: CHEESE_CONFIG.tokenContract,
              account: session.actor.toString(),
              symbol: CHEESE_CONFIG.tokenSymbol,
            }),
          }
        );

        if (!response.ok) {
          continue; // Try next endpoint
        }

        const balances = await response.json();
        if (balances && balances.length > 0) {
          const balance = parseFloat(balances[0].split(' ')[0]);
          setCheeseBalance(balance);
          return; // Success, exit
        } else {
          setCheeseBalance(0);
          return;
        }
      } catch (error) {
        console.error(`Failed to fetch CHEESE balance from ${endpoint}:`, error);
        // Continue to next endpoint
      }
    }

    // All endpoints failed
    console.error('All RPC endpoints failed for CHEESE balance');
    setCheeseBalance(0);
  }, [session]);

  // Refresh all stored sessions
  const refreshSessions = useCallback(async () => {
    try {
      const sessions = await sessionKit.getSessions();
      setAllSessions(sessions);
    } catch (error) {
      console.error('Failed to get sessions:', error);
      setAllSessions([]);
    }
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const restored = await sessionKit.restore();
        if (restored) {
          setSession(restored);
        }
        await refreshSessions();
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    };
    restoreSession();
  }, [refreshSessions]);

  // Initial balance refresh on session change
  useEffect(() => {
    refreshBalance();
  }, [session, refreshBalance]);

  // Periodic balance refresh every 30 seconds when connected
  useEffect(() => {
    if (!session) return;

    const intervalId = setInterval(() => {
      refreshBalance();
    }, 30000); // 30 seconds

    return () => clearInterval(intervalId);
  }, [session, refreshBalance]);

  const login = async () => {
    setIsLoading(true);
    setLoginInProgress(true);
    try {
      const response = await sessionKit.login();
      setSession(response.session);
      toast({
        title: 'Wallet Connected',
        description: `Connected as ${response.session.actor}`,
      });
    } catch (error) {
      console.error('Login failed:', error);
      toast({
        title: 'Login Failed',
        description: error instanceof Error ? error.message : 'Failed to connect wallet',
        variant: 'destructive',
      });
    } finally {
      setLoginInProgress(false);
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (session) {
      try {
        await sessionKit.logout(session);
        setSession(null);
        setCheeseBalance(0);
        toast({
          title: 'Wallet Disconnected',
          description: 'You have been logged out',
        });
      } catch (error) {
        console.error('Logout failed:', error);
      }
    }
  };

  const transferCheese = async (amount: number, memo: string): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const quantity = `${amount.toFixed(CHEESE_CONFIG.tokenPrecision)} ${CHEESE_CONFIG.tokenSymbol}`;

    try {
      const action = {
        account: CHEESE_CONFIG.tokenContract,
        name: 'transfer',
        authorization: [session.permissionLevel],
        data: {
          from: session.actor.toString(),
          to: CHEESE_CONFIG.paymentWallet,
          quantity,
          memo,
        },
      };

      const result = await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast({
        title: 'Transaction Successful',
        description: `Sent ${quantity} to ${CHEESE_CONFIG.paymentWallet}`,
      });

      await refreshBalance();
      return txId;
    } catch (error) {
      console.error('Transfer failed:', error);
      closeWharfkitModals();
      toast({
        title: 'Transaction Failed',
        description: error instanceof Error ? error.message : 'Failed to send CHEESE',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const transferToken = async (
    tokenContract: string,
    tokenSymbol: string,
    precision: number,
    to: string,
    amount: number,
    memo: string
  ): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    const quantity = `${amount.toFixed(precision)} ${tokenSymbol}`;

    try {
      const action = {
        account: tokenContract,
        name: 'transfer',
        authorization: [session.permissionLevel],
        data: {
          from: session.actor.toString(),
          to,
          quantity,
          memo,
        },
      };

      const result = await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;

      await refreshBalance();
      return txId;
    } catch (error) {
      console.error('Transfer failed:', error);
      closeWharfkitModals();
      toast({
        title: 'Transaction Failed',
        description: error instanceof Error ? error.message : 'Failed to send tokens',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const transferNFTs = async (
    to: string,
    assetIds: string[],
    memo: string
  ): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const action = {
        account: 'atomicassets',
        name: 'transfer',
        authorization: [session.permissionLevel],
        data: {
          from: session.actor.toString(),
          to,
          asset_ids: assetIds,
          memo,
        },
      };

      const result = await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;

      return txId;
    } catch (error) {
      console.error('NFT transfer failed:', error);
      closeWharfkitModals();
      toast({
        title: 'Transfer Failed',
        description: error instanceof Error ? error.message : 'Failed to send NFTs',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const claimDrop = async (
    dropId: string,
    quantity: number,
    listingPrice: string,
    tokenContract: string,
    tokenSymbol: string,
    precision: number
  ): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    // Calculate total price (listingPrice is per unit, e.g., "100.0000 CHEESE")
    const priceAmount = parseFloat(listingPrice.split(' ')[0]) * quantity;
    const priceQuantity = `${priceAmount.toFixed(precision)} ${tokenSymbol}`;

    try {
      const actions = [
        {
          account: tokenContract,
          name: 'transfer',
          authorization: [session.permissionLevel],
          data: {
            from: session.actor.toString(),
            to: NFTHIVE_CONFIG.dropContract,
            quantity: priceQuantity,
            memo: 'deposit',
          },
        },
        {
          account: NFTHIVE_CONFIG.dropContract,
          name: 'claimdrop',
          authorization: [session.permissionLevel],
          data: {
            claimer: session.actor.toString(),
            drop_id: parseInt(dropId),
            amount: quantity,
            intended_delphi_median: 0,
            referrer: '',
            country: '',
            currency: `${precision},${tokenSymbol}`,
          },
        },
      ];

      const result = await session.transact({ actions }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;

      await refreshBalance();
      return txId;
    } catch (error) {
      console.error('Claim drop failed:', error);
      closeWharfkitModals();
      toast({
        title: 'Claim Failed',
        description: error instanceof Error ? error.message : 'Failed to claim drop',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  // Claim a free auth-required drop (no payment needed)
  const claimFreeDrop = async (
    dropId: string,
    quantity: number
  ): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const action = {
        account: NFTHIVE_CONFIG.dropContract,
        name: 'claimdrop',
        authorization: [session.permissionLevel],
        data: {
          claimer: session.actor.toString(),
          drop_id: parseInt(dropId),
          amount: quantity,
          intended_delphi_median: 0,
          referrer: '',
          country: '',
          currency: '0,NULL', // Free drops don't need currency
        },
      };

      const result = await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast({
        title: 'Claim Successful! 🧀',
        description: 'Your free NFT has been claimed!',
      });

      return txId;
    } catch (error) {
      console.error('Claim free drop failed:', error);
      closeWharfkitModals();
      toast({
        title: 'Claim Failed',
        description: error instanceof Error ? error.message : 'Failed to claim free drop',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const joinDao = async (daoName: string): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const action = {
        account: 'dao.waxdao',
        name: 'joindao',
        authorization: [session.permissionLevel],
        data: {
          user: session.actor.toString(),
          dao: daoName,
        },
      };

      const result = await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast({
        title: 'Joined DAO',
        description: `Successfully joined ${daoName}`,
      });

      return txId;
    } catch (error) {
      console.error('Join DAO failed:', error);
      closeWharfkitModals();

      const errorMsg = error instanceof Error ? error.message : String(error);

      // If already a member, treat as success and update UI
      if (errorMsg.toLowerCase().includes('already') ||
          errorMsg.toLowerCase().includes('member')) {
        toast({
          title: 'Already a Member',
          description: `You are already a member of ${daoName}`,
        });
        return 'already_member'; // Signal to update UI
      }

      toast({
        title: 'Join Failed',
        description: errorMsg || 'Failed to join DAO',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  const leaveDao = async (daoName: string): Promise<string | null> => {
    if (!session) {
      toast({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet first',
        variant: 'destructive',
      });
      return null;
    }

    try {
      const action = {
        account: 'dao.waxdao',
        name: 'leavedao',
        authorization: [session.permissionLevel],
        data: {
          user: session.actor.toString(),
          dao: daoName,
        },
      };

      const result = await session.transact({ actions: [action] }, { transactPlugins: getTransactPlugins(session) });
      const txId = result.resolved?.transaction.id?.toString() || null;

      toast({
        title: 'Left DAO',
        description: `Successfully left ${daoName}`,
      });

      return txId;
    } catch (error) {
      console.error('Leave DAO failed:', error);
      closeWharfkitModals();
      toast({
        title: 'Leave Failed',
        description: error instanceof Error ? error.message : 'Failed to leave DAO',
        variant: 'destructive',
      });
      return null;
    } finally {
      setTimeout(() => closeWharfkitModals(), 100);
    }
  };

  return (
    <WaxContext.Provider
      value={{
        session,
        isConnected,
        isLoading,
        accountName,
        cheeseBalance,
        login,
        logout,
        refreshBalance,
        transferCheese,
        transferToken,
        transferNFTs,
        claimDrop,
        claimFreeDrop,
        joinDao,
        leaveDao,
      }}
    >
      {children}
    </WaxContext.Provider>
  );
}

export function useWax() {
  const context = useContext(WaxContext);
  if (!context) {
    throw new Error('useWax must be used within a WaxProvider');
  }
  return context;
}
