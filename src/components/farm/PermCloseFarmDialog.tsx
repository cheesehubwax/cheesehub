import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { FarmInfo, buildPermCloseFarmAction } from "@/lib/farm";
import { useWax } from "@/context/WaxContext";
import { useWaxTransaction } from "@/hooks/useWaxTransaction";

interface PermCloseFarmDialogProps {
  farm: FarmInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function PermCloseFarmDialog({ farm, open, onOpenChange, onSuccess }: PermCloseFarmDialogProps) {
  const { accountName, session } = useWax();
  const { executeTransaction } = useWaxTransaction(session);
  const [loading, setLoading] = useState(false);

  const handlePermClose = async () => {
    if (!accountName) return;
    setLoading(true);
    try {
      const action = buildPermCloseFarmAction(accountName, farm.farm_name);
      const result = await executeTransaction([action], {
        successTitle: "Farm Permanently Closed",
        successDescription: `${farm.farm_name} has been permanently closed`,
      });
      if (result.success) {
        onOpenChange(false);
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">⚠️ Permanently Close Farm</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>This action cannot be undone.</strong> The farm will be permanently closed.
            You will need to kick all remaining stakers before you can retrieve any remaining reward tokens.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handlePermClose} disabled={loading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Permanently Close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
