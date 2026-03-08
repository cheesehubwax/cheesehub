import { useState } from "react";
import { User, Check, X } from "lucide-react";

interface RecipientInputProps {
  value: string;
  onChange: (value: string) => void;
  defaultAccount: string;
  disabled?: boolean;
}

export const RecipientInput = ({
  value,
  onChange,
  defaultAccount,
  disabled = false,
}: RecipientInputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  const isValidWaxAccount = (account: string) => {
    if (!account || account.length === 0 || account.length > 12) return false;
    return /^[a-z1-5.]+$/.test(account);
  };

  const isValid = isValidWaxAccount(value);
  const isOwnAccount = value === defaultAccount;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground flex items-center gap-2">
        <User className="w-4 h-4 text-amber-500" />
        Recipient Account
      </label>

      <div
        className={`relative rounded-lg border transition-all duration-200 ${
          isFocused
            ? "border-amber-500/50 bg-secondary/40"
            : "border-border/50 bg-secondary/20"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          placeholder="Enter WAX account name"
          maxLength={12}
          className="w-full bg-transparent px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none font-mono disabled:cursor-not-allowed"
        />

        {value && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <Check className="w-4 h-4 text-green-400" />
            ) : (
              <X className="w-4 h-4 text-red-400" />
            )}
          </div>
        )}
      </div>

      {value && !isValid && (
        <p className="text-xs text-red-400">
          Invalid WAX account. Use 1-12 characters: a-z, 1-5, or period.
        </p>
      )}

      {value && isValid && (
        <p className="text-xs text-muted-foreground">
          {isOwnAccount ? "Resources will be added to your wallet" : "Resources will be added to this account"}
        </p>
      )}
    </div>
  );
};
