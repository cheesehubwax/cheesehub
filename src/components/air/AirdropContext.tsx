// CHEESEAir — snapshot/selection state and the shared presentational interface.
// Cards subscribe only to their own memoized context slice; state and signing stay shared.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Context,
  type ReactNode,
} from 'react';
import { useWax } from '@/context/WaxContext';
import {
  estimateResources,
  type AirdropRecipient,

  type DistributionMode,
  type NftAssignment,
  type ResourceWarning,

} from '@/lib/airdrop';
import {
  getExistingTokenRows,
  getNftHolders,
  getTokenHolders,
  type Holder,
  type HolderSnapshot,
  type InventoryCollection,
  type InventoryTemplate,
} from '@/lib/airdropChain';
import { getSuffixHolders } from '@/lib/airdropSuffix';
import { getVenueLpHolders, type VenueLpPair } from '@/lib/airdropVenueLp';
import { DEFAULT_CPU_PERCENT } from '@/lib/airdropCheese';
import { bytesPerCheese } from '@/lib/airdropResources';
import { useAirAllocation } from '@/hooks/useAirAllocation';
import { useAirCosts } from '@/hooks/useAirCosts';
import { useAirdropRunner, shortError, type PurchaseLogEntry, type BatchLogEntry } from '@/hooks/useAirdropRunner';
export { shortError, type PurchaseLogEntry, type BatchLogEntry } from '@/hooks/useAirdropRunner';
export { RAM_BYTES_PER_ROW } from '@/hooks/useAirCosts';

import {
  useAirAccountResources,
  useAirInventoryAssets,
  useAirInventoryCollections,
  useAirInventoryTemplates,
  useAirRamPrice,
  useAirResourcePricing,
  useAirTokenStat,
  useAirWalletTokens,
  useAirAlcorPairs,
} from '@/hooks/useAirdropQueries';
import {
  buildResultsCsv,
  buildSnapshotCsv,
  downloadCsvFile,
} from '@/lib/airdropCsv';
import { venueLabel, venuePairLabel } from '@/lib/airdropVenueLp';

/** Where the recipient list comes from. */
export type SnapshotMode = 'token' | 'nft' | 'lp' | 'suffix';

export const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
interface AirdropContextValue {
  // wallet
  actor: string | null;
  cheeseBalance: number | null;
  // what to send
  assetKind: 'token' | 'nft' | 'ram';
  setAssetKind: (kind: 'token' | 'nft' | 'ram') => void;
  isNft: boolean;
  isRam: boolean;
  /** RAM mode: whether amounts are entered in CHEESE or in KB of RAM. */
  ramUnit: 'cheese' | 'kb';
  setRamUnit: (unit: 'cheese' | 'kb') => void;
  /** RAM mode: total CHEESE that will be spent buying RAM for recipients. */
  ramCheeseTotal: number;
  /** RAM mode: estimated RAM bytes those purchases deliver. */
  ramBytesTotal: number;
  /** RAM mode: per-purchase CHEESE limits enforced by the RAM contract. */
  ramLimits: { minCheese: number; maxCheese: number } | null;
  /**
   * RAM mode: `belowMin` = accounts skipped because their whole share is under
   * the contract minimum; `split` = accounts paid over several purchases.
   */
  ramExcluded: { belowMin: number; split: number };
  /** RAM mode: account -> how many purchases deliver that account's share. */
  ramPurchaseCounts: Map<string, number>;
  /** RAM mode: total number of contract purchases in the run. */
  ramPurchaseCount: number;

  /** RAM mode: smallest amount (in the selected unit) that includes every ticked holder. */
  ramMinViable: { cheese: number; text: string } | null;
  /** RAM mode: fill the amount field with `ramMinViable`. */
  applyRamMinViable: () => void;
  /** RAM mode: WAX this drop needs from the pool vs what the pool can spend. */
  ramPoolWax: { needed: number; spendable: number; overBy: number } | null;
  /** RAM mode: largest amount (in the selected unit) the pool can cover. */
  ramPoolMaxViable: { cheese: number; text: string } | null;
  /** RAM mode: fill the amount field with `ramPoolMaxViable`. */
  applyRamPoolMax: () => void;

  /** Holders ticked in the table, before contract-limit filtering. */
  selectedCount: number;


  sendContract: string;
  setSendContract: (value: string) => void;
  sendSymbol: string;
  setSendSymbol: (value: string) => void;
  precision: number;
  tokenStat: { precision: number; supply: string } | null;
  walletTokens: Array<{ contract: string; symbol: string; amount: number; precision: number }>;
  // NFT inventory
  nftCollections: InventoryCollection[];
  nftCollection: string;
  setNftCollection: (value: string) => void;
  nftTemplates: InventoryTemplate[];
  nftTemplateId: number | null;
  setNftTemplateId: (value: number | null) => void;
  nftPool: string[];
  nftLoading: null | 'collections' | 'templates' | 'assets';
  nftError: string | null;
  // snapshot
  snapshotMode: SnapshotMode;
  setSnapshotMode: (mode: SnapshotMode) => void;
  lpPairs: VenueLpPair[];
  lpPairsLoading: boolean;
  lpPair: VenueLpPair | null;
  setLpPair: (pair: VenueLpPair | null) => void;
  lpPoolsScanned: number | null;
  lpPositions: number | null;
  snapContract: string;
  setSnapContract: (value: string) => void;
  snapSymbol: string;
  setSnapSymbol: (value: string) => void;
  snapCollection: string;
  setSnapCollection: (value: string) => void;
  snapSuffix: string;
  setSnapSuffix: (value: string) => void;
  snapSchema: string;
  setSnapSchema: (value: string) => void;
  snapTemplate: string;
  setSnapTemplate: (value: string) => void;
  snapshot: HolderSnapshot | null;
  snapshotAt: string | null;
  snapshotError: string | null;
  loadSnapshot: () => Promise<void>;
  // distribution
  mode: DistributionMode;
  setMode: (mode: DistributionMode) => void;
  amountText: string;
  setAmountText: (value: string) => void;
  memo: string;
  setMemo: (value: string) => void;
  batchSize: number;
  setBatchSize: (value: number) => void;
  minWeight: string;
  setMinWeight: (value: string) => void;
  // holders
  filteredHolders: Holder[];
  selected: Set<string>;
  toggle: (account: string) => void;
  quickSelect: (n: number | 'all' | 'none') => void;
  recipients: AirdropRecipient[];
  recipientCount: number;
  total: bigint;
  nftAssignments: NftAssignment[];
  nftShortfall: number;
  /** NFT mode: total NFTs handed out, recipients skipped, NFTs left over. */
  nftAssigned: number;
  nftSkipped: number;
  nftLeftover: number;
  /** NFT mode: how many NFTs of the chosen template you hold. */
  nftPoolSize: number;

  // costs
  estimate: ReturnType<typeof estimateResources>;
  warnings: ResourceWarning[];
  rowStats: { existing: number; checked: number; newRows: number; complete: boolean };
  rowCheckLoading: boolean;
  estCpuCheese: number | null;
  estRamCheese: number | null;
  requiredRamCheese: number | null;
  suggestedCpuCheese: number | null;
  cheesePerCpuMs: number | null;
  cheesePerRamKb: number | null;
  // run
  termsAccepted: boolean;
  setTermsAccepted: (value: boolean) => void;
  busy: string | null;
  runState: 'idle' | 'running' | 'done';
  runError: string | null;
  purchaseLog: PurchaseLogEntry[];
  batchLog: BatchLogEntry[];
  cancelRequested: boolean;
  requestCancel: () => void;
  canRun: boolean;
  runAirdrop: () => Promise<void>;
  /** Download the holder list exactly as snapshotted. */
  downloadSnapshotCsv: () => void;
  /** Download who actually received what, joined to each batch's transaction. */
  downloadResultsCsv: () => void;
}

// Keep mounted providers and refreshed consumers on the same context identity.
// Fast Refresh can reload this module while preserving the existing page tree.
const AirdropContext: Context<AirdropContextValue | null> =
  import.meta.hot?.data.airdropContext ?? createContext<AirdropContextValue | null>(null);
if (import.meta.hot) import.meta.hot.data.airdropContext = AirdropContext;

export function useAirdrop(): AirdropContextValue {
  const ctx = useContext(AirdropContext);
  if (!ctx) throw new Error('useAirdrop must be used inside <AirdropProvider>');
  return ctx;
}

// Preserve every slice identity during Fast Refresh, just like the legacy context.
type AirSendValue = Pick<AirdropContextValue, 'assetKind' | 'setAssetKind' | 'isNft' | 'isRam' | 'ramLimits' | 'cheesePerRamKb' | 'cheeseBalance' | 'actor' | 'sendContract' | 'setSendContract' | 'sendSymbol' | 'setSendSymbol' | 'tokenStat' | 'walletTokens' | 'nftCollections' | 'nftCollection' | 'setNftCollection' | 'nftTemplates' | 'nftTemplateId' | 'setNftTemplateId' | 'nftPool' | 'nftLoading' | 'nftError'>;
const AirSendContext: Context<AirSendValue | null> =
  import.meta.hot?.data.airSendContext ?? createContext<AirSendValue | null>(null);
if (import.meta.hot) import.meta.hot.data.airSendContext = AirSendContext;
export function useAirSend(): AirSendValue {
  const value = useContext(AirSendContext);
  if (!value) throw new Error('useAirSend must be used inside <AirdropProvider>');
  return value;
}

type AirSnapshotValue = Pick<AirdropContextValue, 'snapshotMode' | 'setSnapshotMode' | 'snapContract' | 'setSnapContract' | 'snapSymbol' | 'setSnapSymbol' | 'snapCollection' | 'setSnapCollection' | 'snapSuffix' | 'setSnapSuffix' | 'snapSchema' | 'setSnapSchema' | 'snapTemplate' | 'setSnapTemplate' | 'lpPairs' | 'lpPairsLoading' | 'lpPair' | 'setLpPair' | 'lpPoolsScanned' | 'lpPositions' | 'snapshot' | 'snapshotAt' | 'snapshotError' | 'loadSnapshot' | 'downloadSnapshotCsv' | 'busy'>;
const AirSnapshotContext: Context<AirSnapshotValue | null> =
  import.meta.hot?.data.airSnapshotContext ?? createContext<AirSnapshotValue | null>(null);
if (import.meta.hot) import.meta.hot.data.airSnapshotContext = AirSnapshotContext;
export function useAirSnapshot(): AirSnapshotValue {
  const value = useContext(AirSnapshotContext);
  if (!value) throw new Error('useAirSnapshot must be used inside <AirdropProvider>');
  return value;
}

type AirDistributionValue = Pick<AirdropContextValue, 'isNft' | 'isRam' | 'ramUnit' | 'setRamUnit' | 'ramExcluded' | 'ramPurchaseCount' | 'ramLimits' | 'ramMinViable' | 'applyRamMinViable' | 'ramPoolWax' | 'ramPoolMaxViable' | 'applyRamPoolMax' | 'selectedCount' | 'nftPoolSize' | 'mode' | 'setMode' | 'amountText' | 'setAmountText' | 'sendSymbol' | 'snapshot' | 'memo' | 'setMemo' | 'batchSize' | 'setBatchSize' | 'minWeight' | 'setMinWeight'>;
const AirDistributionContext: Context<AirDistributionValue | null> =
  import.meta.hot?.data.airDistributionContext ?? createContext<AirDistributionValue | null>(null);
if (import.meta.hot) import.meta.hot.data.airDistributionContext = AirDistributionContext;
export function useAirDistribution(): AirDistributionValue {
  const value = useContext(AirDistributionContext);
  if (!value) throw new Error('useAirDistribution must be used inside <AirdropProvider>');
  return value;
}

type AirHoldersValue = Pick<AirdropContextValue, 'filteredHolders' | 'selected' | 'toggle' | 'quickSelect' | 'snapshot' | 'snapshotMode' | 'isNft' | 'isRam' | 'sendSymbol' | 'recipients' | 'ramPurchaseCounts' | 'nftAssignments' | 'precision' | 'cheesePerRamKb'>;
const AirHoldersContext: Context<AirHoldersValue | null> =
  import.meta.hot?.data.airHoldersContext ?? createContext<AirHoldersValue | null>(null);
if (import.meta.hot) import.meta.hot.data.airHoldersContext = AirHoldersContext;
export function useAirHolders(): AirHoldersValue {
  const value = useContext(AirHoldersContext);
  if (!value) throw new Error('useAirHolders must be used inside <AirdropProvider>');
  return value;
}

type AirCostsValue = Pick<AirdropContextValue, 'actor' | 'isNft' | 'isRam' | 'ramCheeseTotal' | 'ramBytesTotal' | 'ramExcluded' | 'ramPurchaseCount' | 'ramPoolWax' | 'ramMinViable' | 'ramLimits' | 'selectedCount' | 'recipientCount' | 'total' | 'precision' | 'sendSymbol' | 'estimate' | 'nftAssignments' | 'nftAssigned' | 'nftSkipped' | 'nftLeftover' | 'nftPoolSize' | 'rowStats' | 'rowCheckLoading' | 'recipients' | 'estCpuCheese' | 'estRamCheese' | 'cheesePerCpuMs' | 'cheesePerRamKb' | 'requiredRamCheese' | 'suggestedCpuCheese' | 'cheeseBalance'>;
const AirCostsContext: Context<AirCostsValue | null> =
  import.meta.hot?.data.airCostsContext ?? createContext<AirCostsValue | null>(null);
if (import.meta.hot) import.meta.hot.data.airCostsContext = AirCostsContext;
export function useAirCosts(): AirCostsValue {
  const value = useContext(AirCostsContext);
  if (!value) throw new Error('useAirCosts must be used inside <AirdropProvider>');
  return value;
}

type AirRunValue = Pick<AirdropContextValue, 'actor' | 'isRam' | 'estimate' | 'ramCheeseTotal' | 'warnings' | 'runError' | 'runState' | 'recipientCount' | 'canRun' | 'runAirdrop' | 'cancelRequested' | 'requestCancel' | 'downloadResultsCsv' | 'purchaseLog' | 'batchLog' | 'termsAccepted' | 'setTermsAccepted'>;
const AirRunContext: Context<AirRunValue | null> =
  import.meta.hot?.data.airRunContext ?? createContext<AirRunValue | null>(null);
if (import.meta.hot) import.meta.hot.data.airRunContext = AirRunContext;
export function useAirRun(): AirRunValue {
  const value = useContext(AirRunContext);
  if (!value) throw new Error('useAirRun must be used inside <AirdropProvider>');
  return value;
}

// Stable empty query results prevent unrelated input changes invalidating allocations.
const EMPTY_WALLET_TOKENS: AirdropContextValue['walletTokens'] = [];
const EMPTY_COLLECTIONS: InventoryCollection[] = [];
const EMPTY_TEMPLATES: InventoryTemplate[] = [];
const EMPTY_ASSETS: string[] = [];
const EMPTY_PAIRS: VenueLpPair[] = [];

export function AirdropProvider({ children }: { children: ReactNode }) {
  const { session, accountName, cheeseBalance, refreshBalance } = useWax();
  const actor = accountName;

  // ---- What to send ------------------------------------------------------
  const [assetKind, setAssetKindState] = useState<'token' | 'nft' | 'ram'>('token');
  const isNft = assetKind === 'nft';
  const isRam = assetKind === 'ram';

  const [ramUnit, setRamUnit] = useState<'cheese' | 'kb'>('cheese');

  const [sendContract, setSendContract] = useState('eosio.token');
  const [sendSymbol, setSendSymbol] = useState('WAX');
  const { data: tokenStatData } = useAirTokenStat(sendContract, sendSymbol);
  const tokenStat = useMemo(() => tokenStatData
    ? { precision: tokenStatData.precision, supply: tokenStatData.supply }
    : null, [tokenStatData]);
  const precision = tokenStat?.precision ?? 8;
  const { data: walletTokens = EMPTY_WALLET_TOKENS } = useAirWalletTokens(actor);

  // ---- NFT inventory ----------------------------------------------------
  const [nftCollection, setNftCollection] = useState('');
  const [nftTemplateId, setNftTemplateId] = useState<number | null>(null);
  const collectionsQuery = useAirInventoryCollections(actor, isNft);
  const templatesQuery = useAirInventoryTemplates(actor, nftCollection, isNft);
  const assetsQuery = useAirInventoryAssets(actor, nftCollection, nftTemplateId, isNft);
  const nftCollections = collectionsQuery.data ?? EMPTY_COLLECTIONS;
  const nftTemplates = templatesQuery.data ?? EMPTY_TEMPLATES;
  const nftPool = assetsQuery.data?.assetIds ?? EMPTY_ASSETS;
  const nftLoading: null | 'collections' | 'templates' | 'assets' = collectionsQuery.isFetching
    ? 'collections'
    : templatesQuery.isFetching
      ? 'templates'
      : assetsQuery.isFetching
        ? 'assets'
        : null;
  const nftError =
    collectionsQuery.error || templatesQuery.error || assetsQuery.error
      ? `Could not load your NFT inventory: ${shortError(
          collectionsQuery.error ?? templatesQuery.error ?? assetsQuery.error,
        )}`
      : null;

  // Reset the template pick whenever the collection changes.
  const handleSetNftCollection = useCallback((value: string) => {
    setNftCollection(value);
    setNftTemplateId(null);
  }, []);

  // ---- Snapshot ---------------------------------------------------------
  const [snapshotMode, setSnapshotMode] = useState<SnapshotMode>('token');
  const [lpPair, setLpPair] = useState<VenueLpPair | null>(null);
  const [lpPoolsScanned, setLpPoolsScanned] = useState<number | null>(null);
  const [lpPositions, setLpPositions] = useState<number | null>(null);
  // Prefetched as soon as CHEESEAir opens so the LP picker is ready on arrival.
  const lpPairsQuery = useAirAlcorPairs(true);
  const lpPairs = lpPairsQuery.data ?? EMPTY_PAIRS;
  const [snapContract, setSnapContract] = useState('');
  const [snapSymbol, setSnapSymbol] = useState('');
  const [snapCollection, setSnapCollection] = useState('');
  const [snapSuffix, setSnapSuffix] = useState('');
  const [snapSchema, setSnapSchema] = useState('');
  const [snapTemplate, setSnapTemplate] = useState('');
  const [snapshot, setSnapshot] = useState<HolderSnapshot | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ---- Distribution -----------------------------------------------------
  const [mode, setMode] = useState<DistributionMode>('equal');
  const [amountText, setAmountText] = useState('');
  const [memo, setMemo] = useState('Airdrop');
  const [batchSize, setBatchSize] = useState(15);
  const [minWeight, setMinWeight] = useState('');

  /** Switching asset type resets the amount to a sensible default for it. */
  const setAssetKind = useCallback((kind: 'token' | 'nft' | 'ram') => {
    setAssetKindState(kind);
    if (kind === 'nft') {
      setMode('fixed');
      setAmountText('1');
    } else {
      setAmountText('');
    }
  }, []);


  // ---- Resources / pricing ---------------------------------------------
  const { data: resources, refetch: refetchResources } = useAirAccountResources(actor);
  const { data: ramPrice } = useAirRamPrice();
  const { data: pricing } = useAirResourcePricing();
  const cpuPercent = DEFAULT_CPU_PERCENT;

  const sortedHolders = useMemo(
    () => [...(snapshot?.holders ?? [])].sort((a, b) => b.weight - a.weight),
    [snapshot],
  );

  const filteredHolders = useMemo(() => {
    const min = parseFloat(minWeight);
    if (!minWeight || isNaN(min) || min <= 0) return sortedHolders;
    return sortedHolders.filter((h) => h.weight >= min);
  }, [sortedHolders, minWeight]);

  const quickSelect = useCallback(
    (n: number | 'all' | 'none') => {
      if (n === 'all') setSelected(new Set(filteredHolders.map((h) => h.account)));
      else if (n === 'none') setSelected(new Set());
      else setSelected(new Set(filteredHolders.slice(0, n).map((h) => h.account)));
    },
    [filteredHolders],
  );

  const toggle = useCallback((account: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(account)) next.delete(account);
      else next.add(account);
      return next;
    });
  }, []);

  const allocation = useAirAllocation({ actor, tokenStat, walletTokens, sendContract, sendSymbol, precision, pricing, ramUnit, amountText, isRam, isNft, filteredHolders, selected, snapshot, mode, nftPool, setAmountText });
  const { chosenHolders, selectedCount, recipients, ramPurchases, ramPurchaseCounts, ramExcluded, ramBelowMin, total, ramCheeseTotal, ramBytesTotal, ramLimits, ramMinViable, applyRamMinViable, ramPoolWax, ramPoolMaxViable, applyRamPoolMax, nftAllocation, nftAssignments, nftShortfall, nftPoolSize } = allocation;

  // ---- Existing token rows ---------------------------------------------
  // Recipients that already hold a row for the token cost the sender no RAM.
  const rowCacheRef = useRef<Map<string, boolean>>(new Map());
  const [rowCacheVersion, setRowCacheVersion] = useState(0);
  const [rowCheckLoading, setRowCheckLoading] = useState(false);
  const rowKey = useCallback(
    (account: string) => `${sendContract}|${sendSymbol.toUpperCase()}|${account}`,
    [sendContract, sendSymbol],
  );
  const recipientAccounts = useMemo(() => recipients.map((r) => r.account), [recipients]);
  const recipientKey = recipientAccounts.join(',');

  useEffect(() => {
    if (isNft || isRam || !sendContract || !sendSymbol || recipientAccounts.length === 0) return;
    const pending = recipientAccounts.filter((a) => !rowCacheRef.current.has(rowKey(a)));
    if (pending.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setRowCheckLoading(true);
      getExistingTokenRows(sendContract, sendSymbol.toUpperCase(), pending)
        .then((res) => {
          if (cancelled) return;
          const unknown = new Set(res.unknown);
          const existing = new Set(res.existing);
          for (const account of pending) {
            if (unknown.has(account)) continue; // leave uncached, stays conservative
            rowCacheRef.current.set(rowKey(account), existing.has(account));
          }
          setRowCacheVersion((v) => v + 1);
        })
        .catch(() => {
          // keep the worst case on failure
        })
        .finally(() => {
          if (!cancelled) setRowCheckLoading(false);
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNft, isRam, sendContract, sendSymbol, recipientKey, rowKey]);

  const rowStats = useMemo(() => {
    void rowCacheVersion;
    let existing = 0;
    let checked = 0;
    for (const account of recipientAccounts) {
      const hit = rowCacheRef.current.get(rowKey(account));
      if (hit === undefined) continue;
      checked += 1;
      if (hit) existing += 1;
    }
    return {
      existing,
      checked,
      newRows: recipientAccounts.length - existing,
      complete: checked === recipientAccounts.length && recipientAccounts.length > 0,
    };
  }, [recipientAccounts, rowKey, rowCacheVersion]);

  const costs = useAirCosts({ ...allocation, isRam, isNft, batchSize, ramPrice, rowStats, pricing, cheeseBalance, mode, precision, sendSymbol, resources, cpuPercent });
  const { ramPurchaseCount, estimate, warnings, hasError, recipientCount, suggestedCpuCheese, requiredRamCheese, cheesePerCpuMs, cheesePerRamKb, estCpuCheese, estRamCheese } = costs;
  const { termsAccepted, setTermsAccepted, busy, setBusy, runState, setRunState, runError, purchaseLog, batchLog, setBatchLog, cancelRequested, requestCancel, canRun, runAirdrop } = useAirdropRunner({ session, actor, cheeseBalance, isRam, isNft, hasError, nftAssignments, nftShortfall, recipients, ramPurchases, ramCheeseTotal, pricing, suggestedCpuCheese, requiredRamCheese, cpuPercent, batchSize, memo, sendContract, sendSymbol, precision, tokenStat, refetchResources, refreshBalance });

  const loadSnapshot = useCallback(async () => {
    setBusy('snapshot');
    setSnapshot(null);
    setSnapshotError(null);
    setRunState('idle');
    setBatchLog([]);
    try {
      setLpPoolsScanned(null);
      setLpPositions(null);
      let snap: HolderSnapshot;
      if (snapshotMode === 'lp') {
        if (!lpPair) throw new Error('Pick a liquidity pair first');
        const lpSnap = await getVenueLpHolders(lpPair);
        setLpPoolsScanned(lpSnap.poolsScanned);
        setLpPositions(lpSnap.positions);
        snap = lpSnap;
      } else if (snapshotMode === 'suffix') {
        snap = await getSuffixHolders(snapSuffix);
      } else {
        snap =
        snapshotMode === 'token'
          ? await getTokenHolders(snapContract, snapSymbol.toUpperCase())
          : await getNftHolders(
              snapCollection,
              snapSchema || undefined,
              snapTemplate ? parseInt(snapTemplate, 10) : undefined,
            );
      }
      // Exclude the sender and common system/contract accounts by default.
      const excluded = new Set(
        [
          actor,
          'eosio',
          'eosio.ram',
          'eosio.stake',
          'swap.alcor',
          'swap.taco',
          'swap.box',
          'lptoken.box',
          sendContract,
          snapContract,
        ].filter(
          (x): x is string => !!x,
        ),
      );
      const holders = snap.holders.filter((h) => ACCOUNT_RE.test(h.account));
      setSnapshot({ ...snap, holders });
      setSelected(new Set(holders.map((h) => h.account).filter((a) => !excluded.has(a))));
      setSnapshotAt(new Date().toISOString());
    } catch (err) {
      setSnapshotError(`Failed to load holders: ${shortError(err)}`);
    } finally {
      setBusy(null);
    }
  }, [
    snapshotMode,
    setBatchLog,
    setBusy,
    setRunState,
    snapContract,
    snapSymbol,
    snapCollection,
    snapSchema,
    snapTemplate,
    snapSuffix,
    lpPair,
    actor,
    sendContract,
  ]);

  const downloadSnapshotCsv = useCallback(() => {
    if (!snapshot) return;
    const what =
      snapshotMode === 'token'
        ? `token ${snapSymbol.toUpperCase()}@${snapContract}`
        : snapshotMode === 'suffix'
          ? `accounts ending in .${snapSuffix.replace(/^\.+/, '')}`
          : snapshotMode === 'nft'
          ? `NFT collection ${snapCollection}${snapSchema ? ` / schema ${snapSchema}` : ''}${snapTemplate ? ` / template ${snapTemplate}` : ''}`
          : lpPair
            ? `${venueLabel(lpPair.venue)} LP ${venuePairLabel(lpPair)}`
            : 'LP pair';
    const { name, lines } = buildSnapshotCsv({
      what,
      source: snapshot.source,
      truncated: snapshot.truncated,
      at: snapshotAt,
      holders: sortedHolders,
      selected,
    });
    downloadCsvFile(name, lines);
  }, [
    snapshot,
    snapshotMode,
    snapContract,
    snapSymbol,
    snapCollection,
    snapSchema,
    snapTemplate,
    snapSuffix,
    lpPair,
    snapshotAt,
    sortedHolders,
    selected,
  ]);

  const downloadResultsCsv = useCallback(() => {
    if (batchLog.length === 0) return;
    const at = snapshotAt;
    if (isRam) {
      const { name, lines } = buildResultsCsv({
        kind: 'ram',
        planned: ramPurchases,
        belowMin: ramBelowMin,
        minCheese: ramLimits?.minCheese ?? null,
        bytesPerCheese: pricing ? (bytesPerCheese(pricing) ?? 0) : 0,
        log: batchLog,
        at,
      });
      downloadCsvFile(name, lines);
      return;
    }
    if (isNft) {
      const assigned = new Set(nftAssignments.map((a) => a.account));
      const { name, lines } = buildResultsCsv({
        kind: 'nft',
        collection: nftCollection,
        templateId: nftTemplateId,
        memo,
        planned: nftAssignments,
        skippedAccounts: chosenHolders.map((h) => h.account).filter((a) => !assigned.has(a)),
        log: batchLog,
        at,
      });
      downloadCsvFile(name, lines);
      return;
    }
    const { name, lines } = buildResultsCsv({
      kind: 'token',
      symbol: sendSymbol,
      precision,
      memo,
      planned: recipients,
      log: batchLog,
      at,
    });
    downloadCsvFile(name, lines);
  }, [
    isNft,
    isRam,
    batchLog,
    ramPurchases,
    ramBelowMin,
    ramLimits,
    pricing,
    nftAssignments,
    chosenHolders,
    nftCollection,
    nftTemplateId,
    recipients,
    precision,
    sendSymbol,
    memo,
    snapshotAt,
  ]);

  const value: AirdropContextValue = {
    actor,
    cheeseBalance: session ? cheeseBalance : null,
    assetKind,
    setAssetKind,
    isNft,
    isRam,
    ramUnit,
    setRamUnit,
    ramCheeseTotal,
    ramBytesTotal,
    ramLimits,
    ramExcluded,
    ramPurchaseCounts,
    ramPurchaseCount,

    ramMinViable,
    applyRamMinViable,
    ramPoolWax,
    ramPoolMaxViable,
    applyRamPoolMax,

    selectedCount,


    sendContract,
    setSendContract,
    sendSymbol,
    setSendSymbol,
    precision,
    tokenStat,
    walletTokens,
    nftCollections,
    nftCollection,
    setNftCollection: handleSetNftCollection,
    nftTemplates,
    nftTemplateId,
    setNftTemplateId,
    nftPool,
    nftLoading,
    nftError,
    snapshotMode,
    setSnapshotMode,
    lpPairs,
    lpPairsLoading: lpPairsQuery.isFetching && !lpPairsQuery.data?.length,
    lpPair,
    setLpPair,
    lpPoolsScanned,
    lpPositions,
    snapContract,
    setSnapContract,
    snapSymbol,
    setSnapSymbol,
    snapCollection,
    setSnapCollection,
    snapSuffix,
    setSnapSuffix,
    snapSchema,
    setSnapSchema,
    snapTemplate,
    setSnapTemplate,
    snapshot,
    snapshotAt,
    snapshotError,
    loadSnapshot,
    mode,
    setMode,
    amountText,
    setAmountText,
    memo,
    setMemo,
    batchSize,
    setBatchSize,
    minWeight,
    setMinWeight,
    filteredHolders,
    selected,
    toggle,
    quickSelect,
    recipients,
    recipientCount,
    total,
    nftAssignments,
    nftShortfall,
    nftAssigned: nftAllocation.assigned,
    nftSkipped: nftAllocation.skipped,
    nftLeftover: nftAllocation.leftover,
    nftPoolSize,
    estimate,
    warnings,
    rowStats,
    rowCheckLoading,
    estCpuCheese,
    estRamCheese,
    requiredRamCheese,
    suggestedCpuCheese,
    cheesePerCpuMs,
    cheesePerRamKb,
    termsAccepted,
    setTermsAccepted,
    busy,
    runState,
    runError,
    purchaseLog,
    batchLog,
    cancelRequested,
    requestCancel,
    canRun,
    runAirdrop,
    downloadSnapshotCsv,
    downloadResultsCsv,
  };

  const sendValue = useMemo<AirSendValue>(() => ({
    assetKind: value.assetKind,
    setAssetKind: value.setAssetKind,
    isNft: value.isNft,
    isRam: value.isRam,
    ramLimits: value.ramLimits,
    cheesePerRamKb: value.cheesePerRamKb,
    cheeseBalance: value.cheeseBalance,
    actor: value.actor,
    sendContract: value.sendContract,
    setSendContract: value.setSendContract,
    sendSymbol: value.sendSymbol,
    setSendSymbol: value.setSendSymbol,
    tokenStat: value.tokenStat,
    walletTokens: value.walletTokens,
    nftCollections: value.nftCollections,
    nftCollection: value.nftCollection,
    setNftCollection: value.setNftCollection,
    nftTemplates: value.nftTemplates,
    nftTemplateId: value.nftTemplateId,
    setNftTemplateId: value.setNftTemplateId,
    nftPool: value.nftPool,
    nftLoading: value.nftLoading,
    nftError: value.nftError,
  }), [
    value.assetKind,
    value.setAssetKind,
    value.isNft,
    value.isRam,
    value.ramLimits,
    value.cheesePerRamKb,
    value.cheeseBalance,
    value.actor,
    value.sendContract,
    value.setSendContract,
    value.sendSymbol,
    value.setSendSymbol,
    value.tokenStat,
    value.walletTokens,
    value.nftCollections,
    value.nftCollection,
    value.setNftCollection,
    value.nftTemplates,
    value.nftTemplateId,
    value.setNftTemplateId,
    value.nftPool,
    value.nftLoading,
    value.nftError,
  ]);

  const snapshotValue = useMemo<AirSnapshotValue>(() => ({
    snapshotMode: value.snapshotMode,
    setSnapshotMode: value.setSnapshotMode,
    snapContract: value.snapContract,
    setSnapContract: value.setSnapContract,
    snapSymbol: value.snapSymbol,
    setSnapSymbol: value.setSnapSymbol,
    snapCollection: value.snapCollection,
    setSnapCollection: value.setSnapCollection,
    snapSuffix: value.snapSuffix,
    setSnapSuffix: value.setSnapSuffix,
    snapSchema: value.snapSchema,
    setSnapSchema: value.setSnapSchema,
    snapTemplate: value.snapTemplate,
    setSnapTemplate: value.setSnapTemplate,
    lpPairs: value.lpPairs,
    lpPairsLoading: value.lpPairsLoading,
    lpPair: value.lpPair,
    setLpPair: value.setLpPair,
    lpPoolsScanned: value.lpPoolsScanned,
    lpPositions: value.lpPositions,
    snapshot: value.snapshot,
    snapshotAt: value.snapshotAt,
    snapshotError: value.snapshotError,
    loadSnapshot: value.loadSnapshot,
    downloadSnapshotCsv: value.downloadSnapshotCsv,
    busy: value.busy,
  }), [
    value.snapshotMode,
    value.setSnapshotMode,
    value.snapContract,
    value.setSnapContract,
    value.snapSymbol,
    value.setSnapSymbol,
    value.snapCollection,
    value.setSnapCollection,
    value.snapSuffix,
    value.setSnapSuffix,
    value.snapSchema,
    value.setSnapSchema,
    value.snapTemplate,
    value.setSnapTemplate,
    value.lpPairs,
    value.lpPairsLoading,
    value.lpPair,
    value.setLpPair,
    value.lpPoolsScanned,
    value.lpPositions,
    value.snapshot,
    value.snapshotAt,
    value.snapshotError,
    value.loadSnapshot,
    value.downloadSnapshotCsv,
    value.busy,
  ]);

  const distributionValue = useMemo<AirDistributionValue>(() => ({
    isNft: value.isNft,
    isRam: value.isRam,
    ramUnit: value.ramUnit,
    setRamUnit: value.setRamUnit,
    ramExcluded: value.ramExcluded,
    ramPurchaseCount: value.ramPurchaseCount,
    ramLimits: value.ramLimits,
    ramMinViable: value.ramMinViable,
    applyRamMinViable: value.applyRamMinViable,
    ramPoolWax: value.ramPoolWax,
    ramPoolMaxViable: value.ramPoolMaxViable,
    applyRamPoolMax: value.applyRamPoolMax,
    selectedCount: value.selectedCount,
    nftPoolSize: value.nftPoolSize,
    mode: value.mode,
    setMode: value.setMode,
    amountText: value.amountText,
    setAmountText: value.setAmountText,
    sendSymbol: value.sendSymbol,
    snapshot: value.snapshot,
    memo: value.memo,
    setMemo: value.setMemo,
    batchSize: value.batchSize,
    setBatchSize: value.setBatchSize,
    minWeight: value.minWeight,
    setMinWeight: value.setMinWeight,
  }), [
    value.isNft,
    value.isRam,
    value.ramUnit,
    value.setRamUnit,
    value.ramExcluded,
    value.ramPurchaseCount,
    value.ramLimits,
    value.ramMinViable,
    value.applyRamMinViable,
    value.ramPoolWax,
    value.ramPoolMaxViable,
    value.applyRamPoolMax,
    value.selectedCount,
    value.nftPoolSize,
    value.mode,
    value.setMode,
    value.amountText,
    value.setAmountText,
    value.sendSymbol,
    value.snapshot,
    value.memo,
    value.setMemo,
    value.batchSize,
    value.setBatchSize,
    value.minWeight,
    value.setMinWeight,
  ]);

  const holdersValue = useMemo<AirHoldersValue>(() => ({
    filteredHolders: value.filteredHolders,
    selected: value.selected,
    toggle: value.toggle,
    quickSelect: value.quickSelect,
    snapshot: value.snapshot,
    snapshotMode: value.snapshotMode,
    isNft: value.isNft,
    isRam: value.isRam,
    sendSymbol: value.sendSymbol,
    recipients: value.recipients,
    ramPurchaseCounts: value.ramPurchaseCounts,
    nftAssignments: value.nftAssignments,
    precision: value.precision,
    cheesePerRamKb: value.cheesePerRamKb,
  }), [
    value.filteredHolders,
    value.selected,
    value.toggle,
    value.quickSelect,
    value.snapshot,
    value.snapshotMode,
    value.isNft,
    value.isRam,
    value.sendSymbol,
    value.recipients,
    value.ramPurchaseCounts,
    value.nftAssignments,
    value.precision,
    value.cheesePerRamKb,
  ]);

  const costsValue = useMemo<AirCostsValue>(() => ({
    actor: value.actor,
    isNft: value.isNft,
    isRam: value.isRam,
    ramCheeseTotal: value.ramCheeseTotal,
    ramBytesTotal: value.ramBytesTotal,
    ramExcluded: value.ramExcluded,
    ramPurchaseCount: value.ramPurchaseCount,
    ramPoolWax: value.ramPoolWax,
    ramMinViable: value.ramMinViable,
    ramLimits: value.ramLimits,
    selectedCount: value.selectedCount,
    recipientCount: value.recipientCount,
    total: value.total,
    precision: value.precision,
    sendSymbol: value.sendSymbol,
    estimate: value.estimate,
    nftAssignments: value.nftAssignments,
    nftAssigned: value.nftAssigned,
    nftSkipped: value.nftSkipped,
    nftLeftover: value.nftLeftover,
    nftPoolSize: value.nftPoolSize,
    rowStats: value.rowStats,
    rowCheckLoading: value.rowCheckLoading,
    recipients: value.recipients,
    estCpuCheese: value.estCpuCheese,
    estRamCheese: value.estRamCheese,
    cheesePerCpuMs: value.cheesePerCpuMs,
    cheesePerRamKb: value.cheesePerRamKb,
    requiredRamCheese: value.requiredRamCheese,
    suggestedCpuCheese: value.suggestedCpuCheese,
    cheeseBalance: value.cheeseBalance,
  }), [
    value.actor,
    value.isNft,
    value.isRam,
    value.ramCheeseTotal,
    value.ramBytesTotal,
    value.ramExcluded,
    value.ramPurchaseCount,
    value.ramPoolWax,
    value.ramMinViable,
    value.ramLimits,
    value.selectedCount,
    value.recipientCount,
    value.total,
    value.precision,
    value.sendSymbol,
    value.estimate,
    value.nftAssignments,
    value.nftAssigned,
    value.nftSkipped,
    value.nftLeftover,
    value.nftPoolSize,
    value.rowStats,
    value.rowCheckLoading,
    value.recipients,
    value.estCpuCheese,
    value.estRamCheese,
    value.cheesePerCpuMs,
    value.cheesePerRamKb,
    value.requiredRamCheese,
    value.suggestedCpuCheese,
    value.cheeseBalance,
  ]);

  const runValue = useMemo<AirRunValue>(() => ({
    actor: value.actor,
    isRam: value.isRam,
    estimate: value.estimate,
    ramCheeseTotal: value.ramCheeseTotal,
    warnings: value.warnings,
    runError: value.runError,
    runState: value.runState,
    recipientCount: value.recipientCount,
    canRun: value.canRun,
    runAirdrop: value.runAirdrop,
    cancelRequested: value.cancelRequested,
    requestCancel: value.requestCancel,
    downloadResultsCsv: value.downloadResultsCsv,
    purchaseLog: value.purchaseLog,
    batchLog: value.batchLog,
    termsAccepted: value.termsAccepted,
    setTermsAccepted: value.setTermsAccepted,
  }), [
    value.actor,
    value.isRam,
    value.estimate,
    value.ramCheeseTotal,
    value.warnings,
    value.runError,
    value.runState,
    value.recipientCount,
    value.canRun,
    value.runAirdrop,
    value.cancelRequested,
    value.requestCancel,
    value.downloadResultsCsv,
    value.purchaseLog,
    value.batchLog,
    value.termsAccepted,
    value.setTermsAccepted,
  ]);

  return (
    <AirdropContext.Provider value={value}>
      <AirSendContext.Provider value={sendValue}>
      <AirSnapshotContext.Provider value={snapshotValue}>
      <AirDistributionContext.Provider value={distributionValue}>
      <AirHoldersContext.Provider value={holdersValue}>
      <AirCostsContext.Provider value={costsValue}>
      <AirRunContext.Provider value={runValue}>
        {children}
      </AirRunContext.Provider>
      </AirCostsContext.Provider>
      </AirHoldersContext.Provider>
      </AirDistributionContext.Provider>
      </AirSnapshotContext.Provider>
      </AirSendContext.Provider>
    </AirdropContext.Provider>
  );
}
