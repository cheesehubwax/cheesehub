import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WalletTransferDialog } from "@/components/wallet/WalletTransferDialog";
import { useWax } from "@/context/WaxContext";
import { Wallet, LogOut, ChevronDown, Send, UserPlus, ArrowRightLeft } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import cheeseLogo from "@/assets/cheese-logo.png";
import { SerializedSession } from "@wharfkit/session";

export function WalletConnect() {
  const {
    session,
    isConnected,
    isLoading,
    accountName,
    cheeseBalance,
    login,
    logout,
    allSessions,
    switchAccount,
    addAccount,
    removeAccount,
  } = useWax();
  const [open, setOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  // Listen for custom event to open wallet
  useEffect(() => {
    const handleOpenWallet = () => {
      if (isConnected) {
        setWalletOpen(true);
      } else {
        setOpen(true);
      }
    };

    window.addEventListener("open-cheese-wallet", handleOpenWallet);
    return () => window.removeEventListener("open-cheese-wallet", handleOpenWallet);
  }, [isConnected]);

  const formatBalance = (balance: number) => {
    return balance.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const getSessionAccount = (s: SerializedSession): string => {
    try {
      return String((s as any).actor || (s as any).auth?.actor || "Unknown");
    } catch {
      return "Unknown";
    }
  };

  const getSessionWallet = (s: SerializedSession): string => {
    try {
      return String((s as any).walletPlugin?.id || (s as any).wallet || "");
    } catch {
      return "";
    }
  };

  const otherSessions = allSessions.filter((s) => {
    const actor = getSessionAccount(s);
    return actor !== accountName;
  });

  // Not connected - show login dialog
  if (!isConnected) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            className="gap-2 bg-cheese hover:bg-cheese-dark text-primary-foreground"
            disabled={isLoading}
          >
            <Wallet className="h-4 w-4" />
            {isLoading ? "Connecting..." : "Connect Wallet"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Your WAX Wallet</DialogTitle>
            <DialogDescription>Choose a wallet to connect to CHEESEHub</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <Button
              onClick={async () => {
                await login();
                setOpen(false);
              }}
              className="w-full bg-cheese hover:bg-cheese-dark text-primary-foreground gap-2"
              size="lg"
              disabled={isLoading}
            >
              <Wallet className="h-5 w-5" />
              {isLoading ? "Connecting..." : "Connect with Anchor or Cloud Wallet"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              You can use Anchor Wallet or WAX Cloud Wallet to connect
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Connected - show account dropdown with multi-account support
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 border-cheese/30 hover:bg-cheese/10">
            <img src={cheeseLogo} alt="CHEESE" className="h-4 w-4" />
            <span className="text-cheese font-semibold">{formatBalance(cheeseBalance)}</span>
            <span className="text-foreground hidden sm:inline">{accountName}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-2 py-2">
            <p className="text-sm font-medium">{accountName}</p>
            <p className="text-xs text-muted-foreground">Active WAX Account</p>
          </div>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setWalletOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            Open Wallet
          </DropdownMenuItem>

          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              Switch Account
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {otherSessions.map((s, i) => {
                const actor = getSessionAccount(s);
                const wallet = getSessionWallet(s);
                return (
                  <DropdownMenuItem
                    key={`${actor}-${i}`}
                    onClick={() => switchAccount(s)}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{actor}</span>
                      {wallet && (
                        <span className="text-xs text-muted-foreground">{wallet}</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={addAccount}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Account
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-destructive">
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <WalletTransferDialog open={walletOpen} onOpenChange={setWalletOpen} />
    </div>
  );
}
