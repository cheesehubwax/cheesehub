import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink } from "lucide-react";

interface TermsConfirmationDialogProps {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TermsConfirmationDialog({ open, onConfirm, onCancel }: TermsConfirmationDialogProps) {
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (open) setAgreed(false);
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Terms of Use</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-muted-foreground">
            Before proceeding with this transaction, please confirm that you have read and agree to our Terms of Use.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-start gap-3 py-4">
          <Checkbox
            id="terms-agree"
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            className="mt-0.5"
          />
          <label htmlFor="terms-agree" className="text-sm cursor-pointer leading-relaxed">
            I have read and agree to the{" "}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Terms of Use
              <ExternalLink className="h-3 w-3" />
            </a>
          </label>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={!agreed}>
            Confirm & Proceed
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
