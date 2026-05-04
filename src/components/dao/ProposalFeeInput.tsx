import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { PROPOSAL_FEE_TOKENS, resolveTokenStats, rememberFeeToken } from "@/lib/dao";

export interface ProposalFeeValue {
  amount: number;
  symbol: string;
  contract: string;
  precision: number;
}

interface Props {
  value: ProposalFeeValue;
  onChange: (v: ProposalFeeValue) => void;
  /** Show validation status + writes successful resolutions to local cache */
  validate?: boolean;
}

type Status = "idle" | "checking" | "ok" | "error";

export function ProposalFeeInput({ value, onChange, validate = true }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Auto-validate when symbol+contract are non-empty (debounced)
  useEffect(() => {
    if (!validate) return;
    const sym = value.symbol.trim().toUpperCase();
    const ct = value.contract.trim().toLowerCase();
    if (!sym || !ct) { setStatus("idle"); return; }

    // Quick path: known token matches preset → mark OK without RPC
    const preset = PROPOSAL_FEE_TOKENS.find(t => t.symbol === sym && t.contract === ct);
    if (preset) {
      setStatus("ok");
      if (value.precision !== preset.precision) {
        onChange({ ...value, precision: preset.precision });
      }
      return;
    }

    setStatus("checking");
    const id = setTimeout(async () => {
      const stats = await resolveTokenStats(ct, sym);
      if (!stats) {
        setStatus("error");
        setErrorMsg(`No ${sym} token found on contract "${ct}"`);
        return;
      }
      setStatus("ok");
      setErrorMsg("");
      rememberFeeToken(sym, ct, stats.precision);
      onChange({ ...value, symbol: sym, contract: ct, precision: stats.precision });
    }, 500);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.symbol, value.contract, validate]);

  const applyPreset = (symbol: string) => {
    const t = PROPOSAL_FEE_TOKENS.find(p => p.symbol === symbol);
    if (!t) return;
    onChange({ ...value, symbol: t.symbol, contract: t.contract, precision: t.precision });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PROPOSAL_FEE_TOKENS.map(t => (
          <Badge
            key={t.symbol}
            variant={value.symbol === t.symbol && value.contract === t.contract ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => applyPreset(t.symbol)}
          >
            {t.symbol}
          </Badge>
        ))}
        <span className="text-xs text-muted-foreground self-center ml-1">or enter any token below</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="sm:col-span-1">
          <Label className="text-xs text-muted-foreground">Amount</Label>
          <Input
            type="number"
            value={value.amount}
            onChange={e => onChange({ ...value, amount: parseFloat(e.target.value) || 0 })}
            min={0}
            step="any"
          />
        </div>
        <div className="sm:col-span-1">
          <Label className="text-xs text-muted-foreground">Token symbol</Label>
          <Input
            value={value.symbol}
            onChange={e => onChange({ ...value, symbol: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 7) })}
            placeholder="WAX"
            maxLength={7}
          />
        </div>
        <div className="sm:col-span-1">
          <Label className="text-xs text-muted-foreground">Token contract</Label>
          <Input
            value={value.contract}
            onChange={e => onChange({ ...value, contract: e.target.value.toLowerCase().replace(/[^a-z1-5.]/g, "").slice(0, 12) })}
            placeholder="eosio.token"
            maxLength={12}
          />
        </div>
      </div>

      {validate && status !== "idle" && (
        <div className="flex items-center gap-1.5 text-xs">
          {status === "checking" && <><Loader2 className="h-3 w-3 animate-spin" /> <span className="text-muted-foreground">Verifying token on-chain…</span></>}
          {status === "ok" && <><Check className="h-3 w-3 text-green-500" /> <span className="text-green-500">Token verified (precision {value.precision})</span></>}
          {status === "error" && <><AlertCircle className="h-3 w-3 text-destructive" /> <span className="text-destructive">{errorMsg}</span></>}
        </div>
      )}
    </div>
  );
}