import { Link, useLocation } from "react-router-dom";
import { WalletConnect } from "./WalletConnect";
import { Lock, Home, ShoppingBag, ShoppingCart, Droplets, Users, Zap, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import cheeseLogo from "@/assets/cheese-logo.png";

export function Header() {
  const location = useLocation();
  const { totalItems, setIsOpen } = useCart();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/60 backdrop-blur-xl">
      {/* Row 1: Logo + Primary Nav + Wallet/Cart */}
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <img src={cheeseLogo} alt="Cheese Logo" className="h-8 w-8" />
            <span className="text-xl font-bold">
              <span className="text-cheese">CHEESE</span>
              <span className="text-foreground">Hub</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {/* Home */}
            <Link
              to="/"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/"
                  ? "bg-cheese/20 text-cheese"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Home className="h-4 w-4" />
              Home
            </Link>
            {/* CHEESEUp */}
            <Link
              to="/powerup"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/powerup"
                  ? "bg-cheese/20 text-cheese"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Zap className="h-4 w-4" />
              CHEESEUp
            </Link>
            {/* CHEESEFaucet (external) */}
            <a
              href="https://cheeseonwax.github.io/tools/cheesefaucet.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Droplets className="h-4 w-4" />
              CHEESEFaucet
            </a>
            {/* CHEESELock */}
            <Link
              to="/locker"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/locker"
                  ? "bg-cheese/20 text-cheese"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Lock className="h-4 w-4" />
              CHEESELock
            </Link>
            {/* CHEESEDrop */}
            <Link
              to="/drops"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/drops"
                  ? "bg-cheese/20 text-cheese"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <ShoppingBag className="h-4 w-4" />
              CHEESEDrop
            </Link>
            {/* CHEESEDao */}
            <Link
              to="/dao"
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                location.pathname === "/dao"
                  ? "bg-cheese/20 text-cheese"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Users className="h-4 w-4" />
              CHEESEDao
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <WalletConnect />
          <Button
            variant="ghost"
            size="icon"
            className="relative hover:bg-primary/10"
            onClick={() => setIsOpen(true)}
          >
            <ShoppingCart className="h-5 w-5 text-primary" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {totalItems}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Row 2: Secondary Nav */}
      <div className="container hidden md:flex h-10 items-center justify-center border-t border-border/30">
        <nav className="flex items-center gap-1">
          {/* CHEESEFarm */}
          <Link
            to="/farm"
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              location.pathname === "/farm"
                ? "bg-cheese/20 text-cheese"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Sprout className="h-4 w-4" />
            CHEESEFarm
          </Link>
        </nav>
      </div>
    </header>
  );
}
