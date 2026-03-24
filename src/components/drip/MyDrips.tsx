import { useState, useEffect } from "react";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";
import {
  DripEscrow,
  ESCROW_CONTRACT,
  fetchUserDrips,
  parseDripStatus,
  getStatusLabel,
  getStatusColor,
  getClaimableCount,
  getTimeUntilNextClaim,
  getDripProgress,
  parseAsset,
  formatInterval,
} from "@/lib/drip";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Droplets, Loader2, ArrowDown, ArrowUp, RefreshCw, Pencil, Check, Download, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { TokenLogo } from "@/components/TokenLogo";
import { TransactionSuccessDialog } from "@/components/wallet/TransactionSuccessDialog";
import { getDripName, setDripName as saveDripName, getAllDripNames, importDripNames } from "@/lib/dripNames";
import { Input } from "@/components/ui/input";
import { useRef } from "react";

export function MyDrips() {
  const { session, accountName, isConnected } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const { toast } = useToast();
  const [paying, setPaying] = useState<DripEscrow[]>([]);
  const [receiving, setReceiving] = useState<DripEscrow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [successDialog, setSuccessDialog] = useState<{ open: boolean; title: string; description: string; txId: string | null }>({
    open: false, title: "", description: "", txId: null,
  });

  const loadDrips = async () => {
    if (!accountName) return;
    setLoading(true);
    try {
      const result = await fetchUserDrips(accountName);
      setPaying(result.paying);
      setReceiving(result.receiving);
    } catch (error) {
      console.error("Failed to load drips:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (accountName) loadDrips();
  }, [accountName]);

  const handleClaim = async (drip: DripEscrow) => {
    if (!session || !accountName) return;
    setActionLoading(drip.ID);
    try {
      const result = await executeTransaction(
        [{
          account: ESCROW_CONTRACT,
          name: "claimdrip",
          authorization: [session.permissionLevel],
          data: { receiver: accountName, ID: drip.ID },
        }],
        { successTitle: "Drip Claimed!", successDescription: `Claimed from drip #${drip.ID}`, showSuccessToast: false }
      );
      if (result.success) {
        const payout = parseAsset(drip.payout_amount);
        const claimable = getClaimableCount(drip);
        setSuccessDialog({
          open: true,
          title: "Drip Claimed!",
          description: `Claimed ${(payout.amount * claimable).toFixed(payout.precision)} ${payout.symbol} from drip #${drip.ID}`,
          txId: result.txId,
        });
      }
      await loadDrips();
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (drip: DripEscrow) => {
    if (!session || !accountName) return;
    setActionLoading(drip.ID);
    try {
      const result = await executeTransaction(
        [{
          account: ESCROW_CONTRACT,
          name: "canceldrip",
          authorization: [session.permissionLevel],
          data: { ID: drip.ID, payer: accountName },
        }],
        { successTitle: "Drip Cancelled", successDescription: `Cancelled drip #${drip.ID}`, showSuccessToast: false }
      );
      if (result.success) {
        setSuccessDialog({
          open: true,
          title: "Drip Cancelled",
          description: `Cancelled drip #${drip.ID}. Remaining funds returned.`,
          txId: result.txId,
        });
      }
      await loadDrips();
    } finally {
      setActionLoading(null);
    }
  };

  const handleFinalize = async (drip: DripEscrow) => {
    if (!session || !accountName) return;
    setActionLoading(drip.ID);
    try {
      const result = await executeTransaction(
        [{
          account: ESCROW_CONTRACT,
          name: "finalizedrip",
          authorization: [session.permissionLevel],
          data: { payer: accountName, ID: drip.ID },
        }],
        { successTitle: "Drip Finalized", successDescription: `Finalized drip #${drip.ID}`, showSuccessToast: false }
      );
      if (result.success) {
        setSuccessDialog({
          open: true,
          title: "Drip Finalized",
          description: `Finalized drip #${drip.ID}. Remaining funds returned.`,
          txId: result.txId,
        });
      }
      await loadDrips();
    } finally {
      setActionLoading(null);
    }
  };

  if (!isConnected) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Droplets className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Connect your wallet to view your drips
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-cheese" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={loadDrips} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Drips I'm Paying */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ArrowUp className="h-5 w-5 text-red-400" />
          Drips I'm Paying
        </h3>
        {paying.length === 0 ? (
          <Card className="border-dashed border-muted-foreground/30">
            <CardContent className="py-8 text-center text-muted-foreground">
              No outgoing drips found
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {paying.map(drip => (
              <DripCard
                key={drip.ID}
                drip={drip}
                role="payer"
                accountName={accountName || ""}
                actionLoading={actionLoading === drip.ID}
                onCancel={() => handleCancel(drip)}
                onFinalize={() => handleFinalize(drip)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Drips I'm Receiving */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ArrowDown className="h-5 w-5 text-green-400" />
          Drips I'm Receiving
        </h3>
        {receiving.length === 0 ? (
          <Card className="border-dashed border-muted-foreground/30">
            <CardContent className="py-8 text-center text-muted-foreground">
              No incoming drips found
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {receiving.map(drip => (
              <DripCard
                key={drip.ID}
                drip={drip}
                role="receiver"
                accountName={accountName || ""}
                actionLoading={actionLoading === drip.ID}
                onClaim={() => handleClaim(drip)}
              />
            ))}
          </div>
        )}
      </div>

      <TransactionSuccessDialog
        open={successDialog.open}
        onOpenChange={(open) => setSuccessDialog(prev => ({ ...prev, open }))}
        title={successDialog.title}
        description={successDialog.description}
        txId={successDialog.txId}
      />
    </div>
  );
}

function DripCard({
  drip,
  role,
  accountName,
  actionLoading,
  onClaim,
  onCancel,
  onFinalize,
}: {
  drip: DripEscrow;
  role: "payer" | "receiver";
  accountName: string;
  actionLoading: boolean;
  onClaim?: () => void;
  onCancel?: () => void;
  onFinalize?: () => void;
}) {
  const status = parseDripStatus(drip);
  const progress = getDripProgress(drip);
  const claimable = getClaimableCount(drip);
  const payout = parseAsset(drip.payout_amount);
  const deposited = parseAsset(drip.total_amount);
  const claimed = parseAsset(drip.total_amount_claimed);
  const isExpired = drip.end_time <= Math.floor(Date.now() / 1000);

  // Countdown display
  const [countdown, setCountdown] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(() => getDripName(accountName, drip.ID));

  const handleSaveName = () => {
    saveDripName(accountName, drip.ID, nameValue);
    setEditingName(false);
  };

  useEffect(() => {
    const update = () => {
      const secs = getTimeUntilNextClaim(drip);
      if (secs <= 0) {
        setCountdown("Now");
        return;
      }
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = Math.floor(secs % 60);
      setCountdown(`${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [drip]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Name + Header */}
        <div className="space-y-1">
          {/* Inline name editor */}
          <div className="flex items-center gap-1.5 min-h-[24px]">
            {editingName ? (
              <>
                <Input
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleSaveName()}
                  className="h-6 text-sm px-1.5 py-0 flex-1"
                  maxLength={50}
                  autoFocus
                  placeholder="Name this drip..."
                />
                <button onClick={handleSaveName} className="text-green-400 hover:text-green-300 shrink-0">
                  <Check className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="flex items-center gap-1 text-sm group"
              >
                {nameValue ? (
                  <span className="font-semibold text-foreground">{nameValue}</span>
                ) : (
                  <span className="text-muted-foreground italic">Add name</span>
                )}
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
          {/* ID + Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono text-muted-foreground">Drip #{drip.ID}</span>
            <Badge variant="outline" className={getStatusColor(status)}>
              {getStatusLabel(status)}
            </Badge>
          </div>
        </div>

        {/* Payout rate */}
        <div className="text-center flex flex-col items-center">
          <div className="flex items-center gap-2">
            <TokenLogo contract={drip.token_contract} symbol={payout.symbol} size="md" />
            <p className="text-lg font-bold text-cheese">
              {payout.amount.toFixed(payout.precision)} {payout.symbol}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            every {formatInterval(drip.hours_between_payouts)}
          </p>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <TokenLogo contract={drip.token_contract} symbol={claimed.symbol} size="sm" />
              Claimed: {claimed.amount.toFixed(claimed.precision)}
            </span>
            <span className="flex items-center gap-1">
              <TokenLogo contract={drip.token_contract} symbol={deposited.symbol} size="sm" />
              Deposited: {deposited.amount.toFixed(deposited.precision)}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">{role === "payer" ? "To" : "From"}:</span>{" "}
            <span className="font-mono">{role === "payer" ? drip.receiver : drip.payer}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Contract:</span>{" "}
            <span className="font-mono">{drip.token_contract}</span>
          </div>
          {status === "active" && (
            <>
              <div>
                <span className="text-muted-foreground">Next claim:</span>{" "}
                <span className={claimable > 0 ? "text-green-400 font-semibold" : ""}>{countdown}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Claimable:</span>{" "}
                <span className={claimable > 0 ? "text-green-400 font-semibold" : ""}>{claimable}</span>
              </div>
            </>
          )}
        </div>

        {/* End time */}
        <p className="text-xs text-muted-foreground text-center">
          Ends: {new Date(drip.end_time * 1000).toLocaleDateString()}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          {role === "receiver" && status === "active" && claimable > 0 && onClaim && (
            <Button
              onClick={onClaim}
              disabled={actionLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              size="sm"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Claim"}
            </Button>
          )}
          {role === "payer" && status === "active" && !isExpired && onCancel && (
            <Button
              onClick={onCancel}
              disabled={actionLoading}
              variant="destructive"
              className="flex-1"
              size="sm"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel"}
            </Button>
          )}
          {role === "payer" && isExpired && status === "active" && onFinalize && (
            <Button
              onClick={onFinalize}
              disabled={actionLoading}
              className="flex-1 bg-cheese hover:bg-cheese-dark text-primary-foreground"
              size="sm"
            >
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finalize"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
