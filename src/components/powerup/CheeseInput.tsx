import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";
import cheeseLogo from "@/assets/cheese-logo.png";

interface CheeseInputProps {
  value: string;
  onChange: (value: string) => void;
  balance?: number;
  label?: string;
  icon?: ReactNode;
  accentColor?: "cpu" | "net" | "cheese";
}

export const CheeseInput = ({
  value,
  onChange,
  balance = 0,
  label = "You spend",
  icon,
  accentColor = "cheese"
}: CheeseInputProps) => {
  const [isFocused, setIsFocused] = useState(false);

  const accentClasses = {
    cpu: "border-amber-500/50",
    net: "border-orange-400/50",
    cheese: "border-primary/50 cheese-glow",
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "rounded-xl p-4 transition-all duration-300 bg-card border border-border/50",
          isFocused && accentClasses[accentColor]
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            Balance: <span className="text-foreground font-mono">{balance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}</span>
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <input
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="0"
              min="0"
              className="w-full bg-transparent text-3xl font-bold text-foreground placeholder:text-muted-foreground/50 outline-none font-mono"
            />
          </div>

          <div className="flex items-center gap-2 bg-secondary/50 px-3 py-2 rounded-xl border border-border/50">
            <img src={cheeseLogo} alt="CHEESE" className="w-6 h-6" />
            <span className="font-bold text-foreground">CHEESE</span>
          </div>
        </div>
      </div>
    </div>
  );
};
