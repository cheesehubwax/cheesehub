import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useWax } from "@/context/WaxContext";
import { ChevronDown, Check, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import cheeseLogo from "@/assets/cheese-logo.png";
import walletIcon from "@/assets/wallet-icon.png";
import { WalletTransferDialog } from "./wallet/WalletTransferDialog";
import { CheeseAmpDialog } from "./music/CheeseAmpDialog";
import { CheeseAmpMiniPlayer } from "./music/CheeseAmpMiniPlayer";
import { useCheeseAmpAutoAdvance } from "@/hooks/useCheeseAmpAutoAdvance";
import { getAudioPlayer } from "@/lib/musicPlayer";
import { useCheeseAmpStore } from "@/stores/cheeseAmpStore";
import { logPlay, flushPlayBuffer, getBufferedPlayCount } from "@/lib/cheeseAmpRoyalties";

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
  const [cheeseAmpOpen, setCheeseAmpOpen] = useState(false);
  const cheeseAmpMinimized = useCheeseAmpStore((state) => state.isMinimized);
  const setCheeseAmpMinimized = useCheeseAmpStore((state) => state.setMinimized);

  // Callback for auto-advance play logging (royalties)
  const handleTrackPlayed = useCallback((templateId: string) => {
    if (session && accountName) {
      logPlay(session, accountName, Number(templateId));
    }
  }, [session, accountName]);

  // Persistent auto-advance hook - works even when CHEESEAmp dialog is minimized
  useCheeseAmpAutoAdvance(accountName, handleTrackPlayed);

  // Flush Cloud Wallet play buffer when wallet opens (opportunistic)
  useEffect(() => {
    if (walletOpen && session && accountName) {
      const buffered = getBufferedPlayCount(accountName);
      if (buffered > 0) {
        flushPlayBuffer(session, accountName).catch(() => {});
      }
    }
  }, [walletOpen, session, accountName]);

  // Listen for custom event to open wallet
  useEffect(() => {
    const handleOpenWallet = () => {
      if (isConnected) {
        setWalletOpen(true);
      } else {
        setOpen(true);
      }
    };
    window.addEventListener('open-cheese-wallet', handleOpenWallet);
    return () => window.removeEventListener('open-cheese-wallet', handleOpenWallet);
  }, [isConnected]);

  // Listen for custom event to open CHEESEAmp
  useEffect(() => {
    const handleOpenCheeseAmp = () => {
      if (isConnected) {
        if (cheeseAmpMinimized) {
          setCheeseAmpMinimized(false);
          setCheeseAmpOpen(true);
        } else {
          setCheeseAmpOpen(true);
        }
      } else {
        setOpen(true);
      }
    };
    window.addEventListener('open-cheese-amp', handleOpenCheeseAmp);
    return () => window.removeEventListener('open-cheese-amp', handleOpenCheeseAmp);
  }, [isConnected, cheeseAmpMinimized]);

  // Close mini player when user logs out
  useEffect(() => {
    if (!isConnected) {
      setCheeseAmpMinimized(false);
    }
  }, [isConnected]);

  const handleLogin = async () => {
    setOpen(false);
    await new Promise(resolve => setTimeout(resolve, 100));
    await login();
  };

  const handleAddAccount = async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    await addAccount();
  };

  const handleCheeseAmpMinimize = () => {
    const player = getAudioPlayer();
    const wasPlaying = player.getState().isPlaying;
    setCheeseAmpOpen(false);
    setCheeseAmpMinimized(true);
    // Radix Dialog unmount can transiently pause media; resume if needed
    if (wasPlaying) {
      setTimeout(() => {
        if (!player.getState().isPlaying) {
          player.resume();
        }
      }, 150);
    }
  };

  const handleCheeseAmpExpand = () => {
    setCheeseAmpMinimized(false);
    setCheeseAmpOpen(true);
  };

  const handleMiniPlayerClose = () => {
    getAudioPlayer().stop();
    setCheeseAmpMinimized(false);
  };

  // Filter out the current session from the switch list
  const otherSessions = allSessions.filter(
    s => String(s.actor) !== accountName
  );

  if (isConnected && accountName) {
    return (
      <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="border-cheese/30 hover:border-cheese hover:bg-cheese/10">
            <img src={walletIcon} alt="Wallet" className="mr-2 h-5 w-5 object-contain" />
            <span className="max-w-[120px] truncate">{accountName}</span>
            <span className="ml-2 text-cheese font-semibold flex items-center gap-1">
              <img src={cheeseLogo} alt="CHEESE" className="h-4 w-4" />
              {cheeseBalance !== null ? cheeseBalance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : '...'}
            </span>
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem 
            onClick={() => {
              if (cheeseAmpMinimized) {
                handleCheeseAmpExpand();
              } else {
                setCheeseAmpOpen(true);
              }
            }} 
            className="cursor-pointer"
          >
            <span className="mr-2 text-base leading-none">🎧</span>
            <span><span className="text-cheese">CHEESE</span>Amp</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setWalletOpen(true)} className="cursor-pointer">
            <img src={walletIcon} alt="Wallet" className="mr-2 h-4 w-4 object-contain" />
            <span><span className="text-cheese">CHEESE</span>Wallet</span>
          </DropdownMenuItem>
          
          {/* Account Switching Submenu */}
          {allSessions.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <span className="mr-2 text-sm leading-none">👥</span>
                  Switch Account
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-56">
                    {/* Current account */}
                    <DropdownMenuItem disabled className="opacity-100">
                      <Check className="mr-2 h-4 w-4 text-cheese" />
                      <span className="font-medium">{accountName}</span>
                      <span className="ml-auto text-xs text-muted-foreground">(active)</span>
                    </DropdownMenuItem>
                    
                    {/* Other accounts */}
                    {otherSessions.map((s) => (
                      <DropdownMenuItem 
                        key={`${String(s.actor)}-${s.permission}`}
                        className="cursor-pointer group"
                        onClick={() => switchAccount(s)}
                      >
                        <div className="w-4 mr-2" />
                        <span>{String(s.actor)}</span>
                        <button
                          className="ml-auto opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAccount(s);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </DropdownMenuItem>
                    ))}
                    
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleAddAccount} className="cursor-pointer">
                      <span className="mr-2 text-sm leading-none">➕</span>
                      Add Account
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </>
          )}
          
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="cursor-pointer">
            <span className="mr-2 text-sm leading-none">🔌</span>
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <WalletTransferDialog open={walletOpen} onOpenChange={setWalletOpen} />
      <CheeseAmpDialog 
        open={cheeseAmpOpen} 
        onOpenChange={setCheeseAmpOpen} 
        onMinimize={handleCheeseAmpMinimize} 
      />
      {cheeseAmpMinimized && (
        <CheeseAmpMiniPlayer
          onExpand={handleCheeseAmpExpand}
          onClose={handleMiniPlayerClose}
        />
      )}
    </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-cheese hover:bg-cheese-dark text-primary-foreground font-semibold">
          <img src={walletIcon} alt="Wallet" className="mr-2 h-5 w-5 object-contain" />
          Connect Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Connect Your Wallet</DialogTitle>
          <DialogDescription className="text-center">
            Connect to Cheese DAO Tools
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <Button
            onClick={handleLogin}
            disabled={isLoading}
            className="h-14 bg-cheese hover:bg-cheese-dark text-primary-foreground"
          >
            <img src={walletIcon} alt="Wallet" className="mr-2 h-6 w-6 object-contain" />
            {isLoading ? "Connecting..." : "Connect Wallet"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Supports WAX Cloud Wallet and Anchor
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
