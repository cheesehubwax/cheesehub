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
  /** WAX per byte of RAM (raw rammarket price). */
  price: number;
  /** CHEESE per KB of RAM, derived from the live Alcor CHEESE/WAX price. */
  cheesePerKb: number | null;
}

/** Live RAM price with a session-only sparkline history, denominated in CHEESE. */
export function useRamPrice() {
  const query = useQuery({
    queryKey: ['cheeseRam', 'ramPrice'],
    queryFn: fetchRamPricePerByte,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const { data: cheesePrice } = useCheesePriceData();
  const waxPerCheese = cheesePrice?.waxPrice ?? 0;

  const pricePerByte = typeof query.data === 'number' ? query.data : null;
  const cheesePerKb =
    pricePerByte !== null && waxPerCheese > 0 ? (pricePerByte * 1024) / waxPerCheese : null;

  const [history, setHistory] = useState<RamPricePoint[]>([]);

  useEffect(() => {
    if (pricePerByte === null || cheesePerKb === null) return;
    setHistory((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.price === pricePerByte && last.cheesePerKb === cheesePerKb) return prev;
      return [...prev, { time: Date.now(), price: pricePerByte, cheesePerKb }].slice(-20);
    });
  }, [pricePerByte, cheesePerKb, query.dataUpdatedAt]);

  return {
    pricePerByte,
    cheesePerKb,
    history,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}


export function useAccountRam(account: string | null) {
  return useQuery({
    queryKey: ['cheeseRam', 'accountRam', account],
    queryFn: () => fetchAccountRam(account as string),
    enabled: !!account,
    staleTime: 20_000,
  });
}
