import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExternalLink, ShieldAlert } from "lucide-react";

interface ExternalLinkWarningProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function ExternalLinkWarning({ open, onOpenChange, url }: ExternalLinkWarningProps) {
  const domain = extractDomain(url);

  const handleContinue = () => {
    window.open(url, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-yellow-500" />
            You are leaving CHEESEHub
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This link goes to an external website not controlled by CHEESEHub.
              Proceed at your own risk.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/50 p-3 text-sm font-mono text-foreground break-all">
              <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              {domain}
            </div>
            <p className="text-xs">
              This may be a referral or affiliate link. CHEESEHub does not endorse
              any advertised products or services. Never enter your private keys
              on any site you don't trust.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Go Back</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleContinue}
            className="bg-cheese hover:bg-cheese-dark text-primary-foreground"
          >
            Continue to {domain}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
