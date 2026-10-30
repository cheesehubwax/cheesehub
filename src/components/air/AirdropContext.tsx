// CHEESEAir — snapshot/selection state and the shared presentational interface.
// The UI cards below `src/components/air/` are presentational and read from here.
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
  const tokenStat = tokenStatData
    ? { precision: tokenStatData.precision, supply: tokenStatData.supply }
    : null;
  const precision = tokenStat?.precision ?? 8;
  const { data: walletTokens = [] } = useAirWalletTokens(actor);

  // ---- NFT inventory ----------------------------------------------------
  const [nftCollection, setNftCollection] = useState('');
  const [nftTemplateId, setNftTemplateId] = useState<number | null>(null);
  const collectionsQuery = useAirInventoryCollections(actor, isNft);
  const templatesQuery = useAirInventoryTemplates(actor, nftCollection, isNft);
  const assetsQuery = useAirInventoryAssets(actor, nftCollection, nftTemplateId, isNft);
  const nftCollections = collectionsQuery.data ?? [];
  const nftTemplates = templatesQuery.data ?? [];
  const nftPool = assetsQuery.data?.assetIds ?? [];
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
  const lpPairs = lpPairsQuery.data ?? [];
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

  return <AirdropContext.Provider value={value}>{children}</AirdropContext.Provider>;
}
