import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ProposalFeeValue {
  amount: number;
  symbol: string;
  contract: string;
  precision: number;
}

interface Props {
  value: ProposalFeeValue;
  onChange: (v: ProposalFeeValue) => void;
  /** Unused — kept for backwards compatibility */
  validate?: boolean;
}

export function ProposalFeeInput({ value, onChange }: Props) {
  // The dao.waxdao smart contract hard-codes proposal_cost to WAX for both
  // createdao and editpropcost. We only collect the amount; symbol/contract/precision are forced.
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Amount (WAX)</Label>
          <Input
            type="number"
            value={value.amount}
            onChange={e =>
              onChange({
                amount: parseFloat(e.target.value) || 0,
                symbol: "WAX",
                contract: "eosio.token",
                precision: 8,
              })
            }
            min={0}
            step="any"
            placeholder="0"
          />
        </div>
        <div className="sm:col-span-1">
          <Label className="text-xs text-muted-foreground">Token</Label>
          <Input value="WAX" disabled readOnly />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Proposal submission fees are denominated in WAX (smart-contract requirement). Governance / voting tokens can still be CHEESE, custom tokens, or NFTs.
      </p>
    </div>
  );
}