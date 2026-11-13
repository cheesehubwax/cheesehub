import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/** The three narrow confirmations kept after the sign-in Terms gate. */
export const RISK_TEXT = {
  lock: "I understand this on-chain lock is permanent and cannot be reversed or unlocked early by anyone.",
  ad: "I confirm this ad contains no malicious links, scams, or illegal material.",
  bridge: "I acknowledge that bridging is executed by Alcor Exchange contracts and CHEESEHub never holds these funds.",
} as const;

interface Props {
  id: string;
  kind: keyof typeof RISK_TEXT;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

export function RiskAcknowledgement({ id, kind, checked, onCheckedChange, className }: Props) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} className="mt-0.5" />
      <label htmlFor={id} className="text-sm text-muted-foreground leading-snug cursor-pointer select-none">
        {RISK_TEXT[kind]}
      </label>
    </div>
  );
}
