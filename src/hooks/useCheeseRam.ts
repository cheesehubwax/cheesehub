import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchAccountRam,
  fetchCheeseRamConfig,
  fetchCheeseRamStats,
  fetchContractReserves,
  fetchRamPricePerByte,
} from '@/lib/cheeseRam';
import { useCheesePriceData } from '@/hooks/useCheesePriceData';

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
  /** WAX per KB of RAM. */
  waxPerKb: number;
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
  const updatedAt = query.dataUpdatedAt;

  useEffect(() => {
    if (pricePerByte === null || cheesePerKb === null) return;
    const waxPerKb = pricePerByte * 1024;
    const stamp = updatedAt || Date.now();
    setHistory((prev) => {
      // Seed the chart with two points so a line renders on the first read.
      if (prev.length === 0) {
        return [
          { time: stamp - 30_000, price: pricePerByte, waxPerKb, cheesePerKb },
          { time: stamp, price: pricePerByte, waxPerKb, cheesePerKb },
        ];
      }
      const last = prev[prev.length - 1];
      if (last.time === stamp) return prev;
      return [...prev, { time: stamp, price: pricePerByte, waxPerKb, cheesePerKb }].slice(-40);
    });
  }, [pricePerByte, cheesePerKb, updatedAt]);

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
