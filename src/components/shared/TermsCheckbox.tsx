import { Checkbox } from "@/components/ui/checkbox";
import { TermsDialog } from "@/components/shared/TermsDialog";
import { cn } from "@/lib/utils";

interface TermsCheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Extra sentence appended after the terms link, e.g. "and understand the CHEESE I spend is nulled forever." */
  extraText?: string;
  className?: string;
}

/**
 * Standard CheeseHub terms gate — "I have read and agree to the Terms of Use"
 * with the Terms of Use opening the TermsDialog. Pair with a state boolean and
 * gate the action button's `disabled` prop.
 */
export function TermsCheckbox({ id = "terms-confirm", checked, onCheckedChange, extraText, className }: TermsCheckboxProps) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="mt-0.5"
      />
      <label htmlFor={id} className="text-sm text-muted-foreground leading-snug cursor-pointer select-none">
        I have read and agree to the <TermsDialog />{extraText ? ` ${extraText}` : ""}
      </label>
    </div>
  );
}
