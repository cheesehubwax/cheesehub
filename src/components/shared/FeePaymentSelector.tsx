import { useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Coins, Info } from "lucide-react";
import { useWax } from "@/context/WaxContext";
import {
  CHEESE_FEE_ENABLED,
  PaymentMethod,
  WAX_FEE_AMOUNT,
} from "@/lib/cheeseFees";
import cheeseLogo from "@/assets/cheese-logo.png";

interface FeePaymentSelectorProps {
  waxFee?: number;
  selectedMethod: PaymentMethod | null;
  onMethodChange: (method: PaymentMethod) => void;
  onCheeseAmountChange: (amount: string) => void;
  onWaxdaoAmountChange?: (amount: string) => void;
  disabled?: boolean;
  hideCheeseOption?: boolean;
}

export function FeePaymentSelector({
  waxFee = WAX_FEE_AMOUNT,
  selectedMethod,
  onMethodChange,
  onCheeseAmountChange,
  onWaxdaoAmountChange,
  disabled = false,
  hideCheeseOption = false,
}: FeePaymentSelectorProps) {
  const { session } = useWax();

  return (
    <TooltipProvider>
      <div className="p-4 rounded-lg border border-cheese/30 bg-cheese/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-cheese" />
            <h3 className="text-sm font-medium text-foreground">Creation Fee</h3>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Info className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>Pay with CHEESE and save 20% on creation fees!</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <RadioGroup
          value={selectedMethod ?? ""}
          onValueChange={(v) => onMethodChange(v as PaymentMethod)}
          className="space-y-3"
          disabled={disabled}
        >
          {!hideCheeseOption && CHEESE_FEE_ENABLED && (
            <div
              className={`relative flex items-start space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                selectedMethod === "cheese"
                  ? "border-cheese/50 bg-cheese/10"
                  : "border-cheese/40 bg-cheese/5 hover:shadow-[0_0_16px_rgba(255,200,50,0.35)]"
              }`}
            >
              <RadioGroupItem value="cheese" id="payment-cheese" disabled={disabled} className="mt-1" />
              <Label htmlFor="payment-cheese" className="flex-1 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={cheeseLogo} alt="CHEESE" className="w-5 h-5" />
                    <span className="font-medium">Pay with CHEESE</span>
                  </div>
                   <div className="flex gap-1.5">
                    <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
                      Save 20%
                    </Badge>
                    <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                      Standard
                    </Badge>
                  </div>
                </div>
              </Label>
            </div>
          )}

          <div
            className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer ${
              selectedMethod === "wax"
                ? "border-amber-500/50 bg-amber-500/10"
                : "border-border/50 hover:bg-muted/30"
            }`}
          >
            <RadioGroupItem value="wax" id="payment-wax" disabled={disabled} className="mt-1" />
            <Label htmlFor="payment-wax" className="flex-1 cursor-pointer">
              <div className="flex items-center justify-between">
                <span className="font-medium">{waxFee} WAX</span>
                <Badge variant="outline" className="text-xs">Alternative</Badge>
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>
    </TooltipProvider>
  );
}
