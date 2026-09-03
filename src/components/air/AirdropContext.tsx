// CHEESEAir — all airdrop state, derived figures and the run sequence.
// The UI cards below `src/components/air/` are presentational and read from here.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWax } from '@/context/WaxContext';
import { useWaxTransaction } from '@/hooks/useWaxTransaction';
import { refreshResourceGauges } from '@/components/shared/ResourceGauges';
import {
  assignAssets,
  chunk,
  computeAmounts,
  estimateNftResources,
  estimateRamAirdropResources,
  estimateResources,
  filterRamRecipients,
  formatQuantity,
  formatUnits,
  resourceWarnings,
  totalUnits,
  RAM_BYTES_PER_NFT,
  type AirdropRecipient,
  type DistributionMode,
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
import {
  CHEESE_CONTRACT,
  CHEESE_CPU_CONTRACT,
  CHEESE_PRECISION,
  CHEESE_RAM_CONTRACT,
  CHEESE_SYMBOL,
  DEFAULT_CPU_PERCENT,
  MIN_RAM_PURCHASE_CHEESE,
  powerupMemo,
  ramMemo,
} from '@/lib/airdropCheese';

import {
  bytesPerCheese,
  ceilCheese,
  cheeseForBytes,
  cheeseForCpuUs,
  cpuUsPerCheese,
  formatCheese,
  splitPurchases,
  weightCalibration,
} from '@/lib/airdropResources';
import {
  useAirAccountResources,
  useAirInventoryAssets,
  useAirInventoryCollections,
  useAirInventoryTemplates,
  useAirRamPrice,
  useAirResourcePricing,
  useAirTokenStat,
  useAirWalletTokens,
} from '@/hooks/useAirdropQueries';

export const ACCOUNT_RE = /^[a-z1-5.]{1,12}$/;
/** RAM bytes a fresh token balance row costs the sender. */
export const RAM_BYTES_PER_ROW = 276;
/** AtomicAssets NFT contract used for NFT drops. */
const ATOMICASSETS_CONTRACT = 'atomicassets';

export function shortError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const detail = msg.match(/"message":"([^"]+)"/)?.[1];
  return (detail ?? msg).slice(0, 300);
}

export interface PurchaseLogEntry {
  kind: 'cpu' | 'ram';
  cheese: number;
  txId?: string;
  error?: string;
}

export interface BatchLogEntry {
  batch: number;
  recipients: number;
  txId?: string;
  error?: string;
}

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
  /** RAM mode: recipients dropped because their share breaks a contract limit. */
  ramExcluded: { belowMin: number; aboveMax: number };

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
  snapshotMode: 'token' | 'nft';
  setSnapshotMode: (mode: 'token' | 'nft') => void;
  snapContract: string;
  setSnapContract: (value: string) => void;
  snapSymbol: string;
  setSnapSymbol: (value: string) => void;
  snapCollection: string;
  setSnapCollection: (value: string) => void;
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
  nftAssignments: Array<{ account: string; assetId: string }>;
  nftShortfall: number;
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
  downloadCsv: () => void;
}

const AirdropContext = createContext<AirdropContextValue | null>(null);

export function useAirdrop(): AirdropContextValue {
  const ctx = useContext(AirdropContext);
  if (!ctx) throw new Error('useAirdrop must be used inside <AirdropProvider>');
  return ctx;
}

export function AirdropProvider({ children }: { children: ReactNode }) {
  const { session, accountName, cheeseBalance, refreshBalance } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const queryClient = useQueryClient();
  const actor = accountName;

  // ---- What to send ------------------------------------------------------
  const [assetKind, setAssetKind] = useState<'token' | 'nft' | 'ram'>('token');
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
  const [snapshotMode, setSnapshotMode] = useState<'token' | 'nft'>('token');
  const [snapContract, setSnapContract] = useState('');
  const [snapSymbol, setSnapSymbol] = useState('');
  const [snapCollection, setSnapCollection] = useState('');
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

  // ---- Resources / pricing ---------------------------------------------
  const { data: resources, refetch: refetchResources } = useAirAccountResources(actor);
  const { data: ramPrice } = useAirRamPrice();
  const { data: pricing } = useAirResourcePricing();
  const cpuPercent = DEFAULT_CPU_PERCENT;

  // ---- Run state --------------------------------------------------------
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [runState, setRunState] = useState<'idle' | 'running' | 'done'>('idle');
  const [runError, setRunError] = useState<string | null>(null);
  const [purchaseLog, setPurchaseLog] = useState<PurchaseLogEntry[]>([]);
  const [batchLog, setBatchLog] = useState<BatchLogEntry[]>([]);
  const [cancelRequested, setCancelRequested] = useState(false);
  const cancelRef = useRef(false);

  const refreshAccount = useCallback(async () => {
    await Promise.all([refetchResources(), refreshBalance?.()]);
    refreshResourceGauges();
  }, [refetchResources, refreshBalance]);

  const loadSnapshot = useCallback(async () => {
    setBusy('snapshot');
    setSnapshot(null);
    setSnapshotError(null);
    setRunState('idle');
    setBatchLog([]);
    try {
      const snap =
        snapshotMode === 'token'
          ? await getTokenHolders(snapContract, snapSymbol.toUpperCase())
          : await getNftHolders(
              snapCollection,
              snapSchema || undefined,
              snapTemplate ? parseInt(snapTemplate, 10) : undefined,
            );
      // Exclude the sender and common system/contract accounts by default.
      const excluded = new Set(
        [actor, 'eosio', 'eosio.ram', 'eosio.stake', sendContract, snapContract].filter(
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
  }, [snapshotMode, snapContract, snapSymbol, snapCollection, snapSchema, snapTemplate, actor, sendContract]);

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

  const senderBalanceUnits = useMemo(() => {
    if (!actor || !tokenStat) return null;
    const t = walletTokens.find(
      (w) => w.contract === sendContract && w.symbol === sendSymbol.toUpperCase(),
    );
    if (!t) return null;
    return BigInt(Math.round(t.amount * 10 ** precision));
  }, [actor, tokenStat, walletTokens, sendContract, sendSymbol, precision]);

  /** RAM contract limits per single purchase, in CHEESE. */
  const ramLimits = useMemo(
    () =>
      pricing ? { minCheese: pricing.ram.minCheese, maxCheese: pricing.ram.maxCheese } : null,
    [pricing],
  );

  /**
   * RAM amounts are always signed as CHEESE transfers, so a KB entry is
   * converted to CHEESE first (with the same safety margin as CHEESERam).
   */
  const ramCheeseText = useMemo(() => {
    if (ramUnit === 'cheese') return amountText;
    const kb = parseFloat(amountText);
    if (!pricing || !(kb > 0)) return '';
    const cheese = cheeseForBytes(kb * 1024, pricing);
    return cheese ? formatCheese(cheese) : '';
  }, [ramUnit, amountText, pricing]);

  const effPrecision = isRam ? CHEESE_PRECISION : precision;

  const { recipients, ramExcluded } = useMemo<{
    recipients: AirdropRecipient[];
    ramExcluded: { belowMin: number; aboveMax: number };
  }>(() => {
    const none = { recipients: [], ramExcluded: { belowMin: 0, aboveMax: 0 } };
    const text = isRam ? ramCheeseText : amountText;
    if (!snapshot || !text) return none;
    const chosen = filteredHolders.filter((h) => selected.has(h.account));
    try {
      const all = computeAmounts(chosen, mode, text, effPrecision);
      if (!isRam) return { recipients: all, ramExcluded: { belowMin: 0, aboveMax: 0 } };
      const base = 10 ** CHEESE_PRECISION;
      const minUnits = ramLimits ? BigInt(Math.round(ramLimits.minCheese * base)) : 0n;
      const maxUnits = ramLimits ? BigInt(Math.round(ramLimits.maxCheese * base)) : 0n;
      const filtered = filterRamRecipients(all, minUnits, maxUnits);
      return {
        recipients: filtered.included,
        ramExcluded: {
          belowMin: filtered.belowMin.length,
          aboveMax: filtered.aboveMax.length,
        },
      };
    } catch {
      return none;
    }
  }, [
    snapshot,
    filteredHolders,
    selected,
    mode,
    amountText,
    ramCheeseText,
    effPrecision,
    isRam,
    ramLimits,
  ]);

  const total = useMemo(() => totalUnits(recipients), [recipients]);

  /** RAM mode: CHEESE spent and the RAM it is expected to deliver. */
  const ramCheeseTotal = isRam ? Number(total) / 10 ** CHEESE_PRECISION : 0;
  const ramBytesTotal = useMemo(() => {
    if (!isRam || !pricing) return 0;
    const per = bytesPerCheese(pricing);
    return per ? ramCheeseTotal * per : 0;
  }, [isRam, pricing, ramCheeseTotal]);


  const selectedAccounts = useMemo(
    () => filteredHolders.filter((h) => selected.has(h.account)).map((h) => h.account),
    [filteredHolders, selected],
  );
  const { assignments: nftAssignments, shortfall: nftShortfall } = useMemo(
    () => (isNft ? assignAssets(nftPool, selectedAccounts) : { assignments: [], shortfall: 0 }),
    [isNft, nftPool, selectedAccounts],
  );

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

  const estimate = useMemo(
    () =>
      isRam
        ? estimateRamAirdropResources(recipients.length, Math.max(1, batchSize))
        : isNft
          ? estimateNftResources(
              nftAssignments.length,
              Math.max(1, batchSize),
              ramPrice?.waxPerKb ?? 0.1,
            )
          : estimateResources(
              recipients.length,
              Math.max(1, batchSize),
              ramPrice?.waxPerNewRow ?? 0.028,
              rowStats.checked > 0 ? rowStats.newRows : null,
            ),
    [isRam, isNft, nftAssignments.length, recipients.length, batchSize, ramPrice, rowStats],
  );

  const warnings = useMemo(() => {
    if (isRam) {
      // RAM lands directly in each recipient's account, so the sender only
      // needs enough CHEESE — plus every purchase must obey the contract limits.
      const out: ResourceWarning[] = [];
      if (!pricing) {
        out.push({
          level: 'warn',
          message: `${CHEESE_SYMBOL} RAM pricing is unavailable right now, so amounts and costs cannot be quoted yet.`,
        });
      } else if (!pricing.ram.enabled) {
        out.push({
          level: 'error',
          message: `The ${CHEESE_RAM_CONTRACT} contract has RAM buying disabled right now, so RAM cannot be airdropped.`,
        });
      }
      if (cheeseBalance !== null && ramCheeseTotal > 0 && cheeseBalance < ramCheeseTotal) {
        out.push({
          level: 'error',
          message: `This RAM airdrop spends ${formatCheese(ramCheeseTotal)} ${CHEESE_SYMBOL} but your balance is ${formatCheese(cheeseBalance)} ${CHEESE_SYMBOL} (CPU/NET top-ups are extra).`,
        });
      }
      if (ramExcluded.belowMin > 0 && ramLimits) {
        out.push({
          level: 'warn',
          message: `${ramExcluded.belowMin} recipient${ramExcluded.belowMin === 1 ? '' : 's'} skipped: their share is below the ${formatCheese(ramLimits.minCheese)} ${CHEESE_SYMBOL} minimum per purchase. Raise the amount or deselect holders.`,
        });
      }
      if (ramExcluded.aboveMax > 0 && ramLimits) {
        out.push({
          level: 'warn',
          message: `${ramExcluded.aboveMax} recipient${ramExcluded.aboveMax === 1 ? '' : 's'} skipped: their share is above the ${formatCheese(ramLimits.maxCheese)} ${CHEESE_SYMBOL} maximum per purchase. Lower the amount or split the drop.`,
        });
      }
      return out;
    }
    if (isNft) {
      // NFTs come out of your own inventory: the only blocker is pool coverage.
      return nftShortfall > 0
        ? [
            {
              level: 'error' as const,
              message: `You need ${nftShortfall} more NFT${nftShortfall === 1 ? '' : 's'} of this template to cover every selected recipient. Deselect recipients or pick a template you own more of.`,
            },
          ]
        : [];
    }
    // Resource shortfalls are handled with CHEESE top-ups, so only the token
    // balance is validated here.
    return resourceWarnings(
      estimate,
      null,
      senderBalanceUnits,
      total,
      precision,
      sendSymbol.toUpperCase(),
    );
  }, [
    isRam,
    pricing,
    cheeseBalance,
    ramCheeseTotal,
    ramExcluded,
    ramLimits,
    isNft,
    nftShortfall,
    estimate,
    senderBalanceUnits,
    total,
    precision,
    sendSymbol,
  ]);
  const hasError = warnings.some((w) => w.level === 'error');

  // ---- CHEESE resource purchases ---------------------------------------
  const calibration = useMemo(
    () =>
      resources
        ? weightCalibration(resources)
        : { cpuUsPerWeightUnit: null, netBytesPerWeightUnit: null },
    [resources],
  );

  const recipientCount = isNft ? nftAssignments.length : recipients.length;

  /** CPU needed for one batch plus 20% headroom. */
  const cpuNeededUs = estimate.cpuPerTxUs * 1.2;
  const ramNeededBytes = estimate.maxNewRows * (isNft ? RAM_BYTES_PER_NFT : RAM_BYTES_PER_ROW);

  const cpuShortUs =
    resources && recipientCount > 0 ? Math.max(0, cpuNeededUs - resources.cpuAvailableUs) : 0;
  const ramShortBytes =
    resources && recipientCount > 0 ? Math.max(0, ramNeededBytes - resources.ramAvailableBytes) : 0;

  const suggestedCpuCheese = useMemo(
    () =>
      pricing && cpuShortUs > 0
        ? cheeseForCpuUs(cpuShortUs, pricing, calibration, cpuPercent)
        : null,
    [pricing, cpuShortUs, calibration, cpuPercent],
  );

  /** RAM is always purchased: at least the minimum, more when the drop needs it. */
  const requiredRamCheese = useMemo(() => {
    // In RAM mode the drop itself buys RAM for the recipients; the sender's own
    // account needs no extra RAM.
    if (isRam || !pricing) return null;
    const needed = ramShortBytes > 0 ? cheeseForBytes(ramShortBytes, pricing) : 0;
    return ceilCheese(Math.max(MIN_RAM_PURCHASE_CHEESE, needed ?? 0, pricing.ram.minCheese));
  }, [isRam, pricing, ramShortBytes]);


  const cheesePerCpuMs = useMemo(() => {
    if (!pricing) return null;
    const per = cpuUsPerCheese(pricing, calibration, cpuPercent);
    if (!per || per <= 0) return null;
    return 1000 / per;
  }, [pricing, calibration, cpuPercent]);

  const cheesePerRamKb = useMemo(() => {
    if (!pricing) return null;
    const per = bytesPerCheese(pricing);
    if (!per || per <= 0) return null;
    return 1024 / per;
  }, [pricing]);

  const estCpuCheese = useMemo(
    () =>
      pricing && recipientCount > 0
        ? cheeseForCpuUs(cpuNeededUs, pricing, calibration, cpuPercent)
        : null,
    [pricing, cpuNeededUs, calibration, cpuPercent, recipientCount],
  );
  const estRamCheese = useMemo(
    () => (pricing && ramNeededBytes > 0 ? cheeseForBytes(ramNeededBytes, pricing) : null),
    [pricing, ramNeededBytes],
  );

  /** Sign one or more CHEESE transfers to a resource contract. True on full success. */
  const buyWithCheese = useCallback(
    async (kind: 'cpu' | 'ram', amounts: number[]): Promise<boolean> => {
      if (!session || !actor || amounts.length === 0) return false;
      const to = kind === 'cpu' ? CHEESE_CPU_CONTRACT : CHEESE_RAM_CONTRACT;
      const memoText =
        kind === 'cpu' ? powerupMemo(actor, cpuPercent) : ramMemo(actor, true);
      setBusy(kind === 'cpu' ? 'buy-cpu' : 'buy-ram');
      let ok = true;
      try {
        for (let i = 0; i < amounts.length; i += 1) {
          const cheese = amounts[i];
          if (cheese === undefined || cheese <= 0) continue;
          const result = await executeTransaction(
            [
              {
                account: CHEESE_CONTRACT,
                name: 'transfer',
                authorization: [session.permissionLevel],
                data: {
                  from: actor,
                  to,
                  quantity: `${formatCheese(cheese)} ${CHEESE_SYMBOL}`,
                  memo: memoText,
                },
              },
            ],
            { showSuccessToast: false, showErrorToast: true, errorTitle: 'Resource purchase failed' },
          );
          if (result.success) {
            setPurchaseLog((prev) => [...prev, { kind, cheese, txId: result.txId ?? undefined }]);
          } else {
            ok = false;
            setPurchaseLog((prev) => [
              ...prev,
              { kind, cheese, error: shortError(result.error ?? new Error('Transaction failed')) },
            ]);
            break;
          }
          if (i < amounts.length - 1) await new Promise((r) => setTimeout(r, 1200));
        }
      } finally {
        setBusy(null);
      }
      // Give the chain a moment to apply the powerup / RAM purchase, then re-read.
      await new Promise((r) => setTimeout(r, 3000));
      await refreshAccount();
      return ok;
    },
    [session, actor, cpuPercent, executeTransaction, refreshAccount],
  );

  const requestCancel = useCallback(() => {
    cancelRef.current = true;
    setCancelRequested(true);
  }, []);

  const canRun =
    !!session &&
    termsAccepted &&
    !hasError &&
    runState !== 'running' &&
    busy === null &&
    (isNft
      ? nftAssignments.length > 0 && nftShortfall === 0
      : isRam
        ? recipients.length > 0 && !!pricing?.ram.enabled
        : recipients.length > 0 && tokenStat !== null);

  const runAirdrop = useCallback(async () => {
    if (!session || !actor) return;
    if (isNft ? nftAssignments.length === 0 || nftShortfall > 0 : recipients.length === 0) return;

    setBatchLog([]);
    setPurchaseLog([]);
    setRunError(null);

    // Every airdrop buys RAM with CHEESE first; CPU/NET only when short.
    if (!pricing) {
      setRunError(
        `${CHEESE_SYMBOL} resource pricing is unavailable right now, so the required RAM purchase cannot be made. Try again in a moment.`,
      );
      return;
    }
    if (!pricing.ram.enabled) {
      setRunError(
        `The ${CHEESE_RAM_CONTRACT} contract has RAM buying disabled right now, so RAM cannot be bought. Try again later.`,
      );
      return;
    }
    if (isRam) {
      // The drop itself is the RAM purchase: no sender RAM buy, only CPU/NET.
      const needed = ramCheeseTotal + (suggestedCpuCheese ?? 0);
      if (cheeseBalance !== null && cheeseBalance < needed) {
        setRunError(
          `This RAM airdrop needs ${formatCheese(needed)} ${CHEESE_SYMBOL} (including CPU/NET top-ups), but your balance is ${formatCheese(cheeseBalance)} ${CHEESE_SYMBOL}.`,
        );
        return;
      }
      if (suggestedCpuCheese) {
        const ok = await buyWithCheese('cpu', [suggestedCpuCheese]);
        if (!ok) return;
      }
    } else {
      if (requiredRamCheese === null) {
        setRunError(
          `${CHEESE_SYMBOL} resource pricing is unavailable right now, so the required RAM purchase cannot be made. Try again in a moment.`,
        );
        return;
      }
      const totalNeeded = requiredRamCheese + (suggestedCpuCheese ?? 0);
      if (cheeseBalance !== null && cheeseBalance < totalNeeded) {
        setRunError(
          `This airdrop requires ${formatCheese(totalNeeded)} ${CHEESE_SYMBOL} of resources (including the ${formatCheese(requiredRamCheese)} ${CHEESE_SYMBOL} RAM purchase), but your balance is ${formatCheese(cheeseBalance)} ${CHEESE_SYMBOL}.`,
        );
        return;
      }
      if (suggestedCpuCheese) {
        const ok = await buyWithCheese('cpu', [suggestedCpuCheese]);
        if (!ok) return;
      }
      const ramOk = await buyWithCheese(
        'ram',
        splitPurchases(requiredRamCheese, pricing.ram.minCheese, pricing.ram.maxCheese),
      );
      if (!ramOk) return;
    }

    setRunState('running');
    setBatchLog([]);
    setCancelRequested(false);
    cancelRef.current = false;

    if (isRam) {
      // One CHEESE transfer per recipient: ram.chz buys RAM into the memo account.
      const batches = chunk(recipients, Math.max(1, batchSize));
      for (let i = 0; i < batches.length; i += 1) {
        if (cancelRef.current) {
          setBatchLog((prev) => [
            ...prev,
            { batch: i + 1, recipients: 0, error: 'Cancelled by user' },
          ]);
          break;
        }
        const batch = batches[i];
        if (!batch) continue;
        const result = await executeTransaction(
          batch.map((r) => ({
            account: CHEESE_CONTRACT,
            name: 'transfer',
            authorization: [session.permissionLevel],
            data: {
              from: actor,
              to: CHEESE_RAM_CONTRACT,
              quantity: formatQuantity(r.units, CHEESE_PRECISION, CHEESE_SYMBOL),
              memo: r.account === actor ? '' : r.account,
            },
          })),
          { showSuccessToast: false, showErrorToast: false },
        );
        setBatchLog((prev) => [
          ...prev,
          result.success
            ? { batch: i + 1, recipients: batch.length, txId: result.txId ?? undefined }
            : {
                batch: i + 1,
                recipients: batch.length,
                error: shortError(result.error ?? new Error('Transaction failed')),
              },
        ]);
        if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 1200));
      }
      setRunState('done');
      void refreshAccount();
      return;
    }



    if (isNft) {
      const batches = chunk(nftAssignments, Math.max(1, batchSize));
      for (let i = 0; i < batches.length; i += 1) {
        if (cancelRef.current) {
          setBatchLog((prev) => [
            ...prev,
            { batch: i + 1, recipients: 0, error: 'Cancelled by user' },
          ]);
          break;
        }
        const batch = batches[i];
        if (!batch) continue;
        const result = await executeTransaction(
          batch.map((a) => ({
            account: ATOMICASSETS_CONTRACT,
            name: 'transfer',
            authorization: [session.permissionLevel],
            data: { from: actor, to: a.account, asset_ids: [a.assetId], memo },
          })),
          { showSuccessToast: false, showErrorToast: false },
        );
        setBatchLog((prev) => [
          ...prev,
          result.success
            ? { batch: i + 1, recipients: batch.length, txId: result.txId ?? undefined }
            : {
                batch: i + 1,
                recipients: batch.length,
                error: shortError(result.error ?? new Error('Transaction failed')),
              },
        ]);
        if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 1200));
      }
      setRunState('done');
      void refreshAccount();
      void queryClient.invalidateQueries({ queryKey: ['air-inventory-assets'] });
      return;
    }

    const batches = chunk(recipients, Math.max(1, batchSize));
    for (let i = 0; i < batches.length; i += 1) {
      if (cancelRef.current) {
        setBatchLog((prev) => [
          ...prev,
          { batch: i + 1, recipients: 0, error: 'Cancelled by user' },
        ]);
        break;
      }
      const batch = batches[i];
      if (!batch) continue;
      const result = await executeTransaction(
        batch.map((r) => ({
          account: sendContract,
          name: 'transfer',
          authorization: [session.permissionLevel],
          data: {
            from: actor,
            to: r.account,
            quantity: formatQuantity(r.units, precision, sendSymbol.toUpperCase()),
            memo,
          },
        })),
        { showSuccessToast: false, showErrorToast: false },
      );
      setBatchLog((prev) => [
        ...prev,
        result.success
          ? { batch: i + 1, recipients: batch.length, txId: result.txId ?? undefined }
          : {
              batch: i + 1,
              recipients: batch.length,
              error: shortError(result.error ?? new Error('Transaction failed')),
            },
      ]);
      if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 1200));
    }

    setRunState('done');
    void refreshAccount();
    void queryClient.invalidateQueries({ queryKey: ['air-wallet-tokens'] });
  }, [
    session,
    actor,
    isNft,
    nftAssignments,
    nftShortfall,
    recipients,
    pricing,
    requiredRamCheese,
    suggestedCpuCheese,
    cheeseBalance,
    buyWithCheese,
    batchSize,
    executeTransaction,
    memo,
    sendContract,
    sendSymbol,
    precision,
    refreshAccount,
    queryClient,
  ]);

  const downloadCsv = useCallback(() => {
    const quotedMemo = `"${memo.replace(/"/g, '""')}"`;
    const stamp = snapshotAt?.slice(0, 19).replace(/[:T]/g, '-') ?? 'report';
    let lines: string[];
    let name: string;
    if (isNft) {
      lines = ['account,asset_id,collection,template_id,memo'];
      for (const a of nftAssignments) {
        lines.push(
          `${a.account},${a.assetId},${nftCollection},${nftTemplateId ?? ''},${quotedMemo}`,
        );
      }
      name = `airdrop-nft-${nftCollection || 'assets'}-${stamp}.csv`;
    } else {
      lines = ['account,amount,token,memo'];
      for (const r of recipients) {
        lines.push(
          `${r.account},${formatUnits(r.units, precision)},${sendSymbol.toUpperCase()},${quotedMemo}`,
        );
      }
      name = `airdrop-${sendSymbol.toLowerCase()}-${stamp}.csv`;
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    isNft,
    nftAssignments,
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
    snapContract,
    setSnapContract,
    snapSymbol,
    setSnapSymbol,
    snapCollection,
    setSnapCollection,
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
    downloadCsv,
  };

  return <AirdropContext.Provider value={value}>{children}</AirdropContext.Provider>;
}
