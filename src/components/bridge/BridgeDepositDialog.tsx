import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DepositAddressPanel } from "./DepositAddressPanel";

export function BridgeDepositDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (o: boolean) => void; account: string | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>🌉 Bridge In / Deposit</DialogTitle></DialogHeader>
        <DepositAddressPanel account={account} idSuffix="wallet" />
        <Button asChild variant="outline" className="w-full">
          <Link to="/bridge" onClick={() => onOpenChange(false)}>Open full ALCORBridge</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
