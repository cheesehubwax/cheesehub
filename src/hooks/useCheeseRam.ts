import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAccountRam,
  fetchCheeseRamConfig,
  fetchCheeseRamStats,
  fetchContractReserves,
  fetchRamPricePerByte,
} from '@/lib/cheeseRam';

export function useCheeseRamConfig() {
  return useQuery({
    queryKey: ['cheeseRam', 'config'],
    queryFn: fetchCheeseRamConfig,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

export function useCheeseRamStats() {
  return useQuery({
    queryKey: ['cheeseRam', 'stats'],
    queryFn: fetchCheeseRamStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useCheeseRamReserves() {
  return useQuery({
    queryKey: ['cheeseRam', 'reserves'],
    queryFn: fetchContractReserves,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export interface RamPricePoint {
  time: number;
  price: number;
}

/** Live RAM price with a session-only sparkline history. */
export function useRamPrice() {
  const query = useQuery({
    queryKey: ['cheeseRam', 'ramPrice'],
    queryFn: fetchRamPricePerByte,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const [history, setHistory] = useState<RamPricePoint[]>([]);

  useEffect(() => {
    if (typeof query.data !== 'number') return;
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.price === query.data) return prev;
      return [...prev, { time: Date.now(), price: query.data as number }].slice(-20);
    });
  }, [query.data, query.dataUpdatedAt]);

  return { pricePerByte: query.data ?? null, history, isLoading: query.isLoading, refetch: query.refetch };
}

export function useAccountRam(account: string | null) {
  return useQuery({
    queryKey: ['cheeseRam', 'accountRam', account],
    queryFn: () => fetchAccountRam(account as string),
    enabled: !!account,
    staleTime: 20_000,
  });
}
