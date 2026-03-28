import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Trash2, ShoppingCart, Loader2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useWax } from "@/context/WaxContext";
import { usePurchaseDrop } from "@/hooks/usePurchaseDrop";
import { useTransactionSuccess } from "@/context/TransactionSuccessContext";
import { useToast } from "@/hooks/use-toast";
import { useTermsConfirmation } from "@/hooks/useTermsConfirmation";
import { TermsConfirmationDialog } from "@/components/shared/TermsConfirmationDialog";

export function CartDrawer() {
  const { items, removeFromCart, clearCart, isOpen, setIsOpen, totalItems } = useCart();
  const { isConnected } = useWax();
  const { purchaseDrop, purchasing } = usePurchaseDrop();
  const { showSuccess } = useTransactionSuccess();
  const { toast } = useToast();
  const { requireTerms, termsDialogProps } = useTermsConfirmation();

  const handlePurchaseAll = async () => {
    let lastTxId: string | undefined;
    for (const item of items) {
      const result = await purchaseDrop(item, item.quantity, item.selectedPrice);
      if (!result.success) {
        toast({ title: "Purchase Failed", description: result.error, variant: "destructive" });
        return;
      }
      lastTxId = result.transactionId;
    }
    clearCart();
    showSuccess(
      "All items purchased! 🧀",
      `${totalItems} item${totalItems !== 1 ? 's' : ''} claimed successfully`,
      lastTxId ?? null
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Cart ({totalItems})
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col mt-4 overflow-hidden" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-muted-foreground">Your cart is empty</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-3">
                {items.map(item => (
                  <div key={`${item.id}-${item.selectedPrice.currency}`} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/40">
                    <img
                      src={item.image || "/placeholder.svg"}
                      alt={item.name}
                      className="h-14 w-14 rounded object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.selectedPrice.price} {item.selectedPrice.currency} × {item.quantity}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeFromCart(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="pt-4 space-y-3">
                <Separator />
                <div className="flex justify-between text-sm font-medium">
                  <span>Total Items</span>
                  <span>{totalItems}</span>
                </div>

                {!isConnected ? (
                  <p className="text-sm text-muted-foreground text-center">Connect wallet to purchase</p>
                ) : (
                  <Button
                    className="w-full bg-primary text-primary-foreground"
                    onClick={() => {
                      const hasOfficialItems = items.some(item => (item as any).collectionName === "cheesenftwax");
                      if (hasOfficialItems) {
                        requireTerms(handlePurchaseAll);
                      } else {
                        handlePurchaseAll();
                      }
                    }}
                    disabled={purchasing}
                  >
                    {purchasing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...</> : "Purchase All"}
                  </Button>
                )}

                <Button variant="outline" className="w-full" onClick={clearCart}>
                  Clear Cart
                </Button>
                <TermsConfirmationDialog {...termsDialogProps} />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
