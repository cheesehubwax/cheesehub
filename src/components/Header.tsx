import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { WalletConnect } from "./WalletConnect";
import { Lock, Home, ShoppingBag, ShoppingCart, Users, Zap, Sprout, Flame, Droplets, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import cheeseLogo from "@/assets/cheese-logo.png";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home },
  { to: "/powerup", label: "CHEESEUp", icon: Zap },
  { to: "/locker", label: "CHEESELock", icon: Lock },
  { to: "/drops", label: "CHEESEShip", icon: ShoppingBag },
  { to: "/dao", label: "CHEESEDao", icon: Users },
  { to: "/farm", label: "CHEESEFarm", icon: Sprout },
  { to: "/cheesenull", label: "CHEESENull", icon: Flame },
  { to: "/drip", label: "CHEESEDrip", icon: Droplets },
];

const PRIMARY_NAV = NAV_ITEMS.slice(0, 5);
const SECONDARY_NAV = NAV_ITEMS.slice(5);

export function Header() {
  const location = useLocation();
  const { totalItems, setIsOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinkClass = (path: string) =>
    cn(
      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
      location.pathname === path
        ? "bg-cheese/20 text-cheese"
        : "text-foreground hover:text-cheese hover:bg-muted"
    );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/60 backdrop-blur-xl">
      <div className="container flex h-14 sm:h-16 items-center justify-between">
        <div className="flex items-center gap-4 md:gap-8">
          {/* Mobile menu button */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <div className="flex items-center gap-2 p-4 border-b border-border/50">
                <img src={cheeseLogo} alt="Cheese Logo" className="h-8 w-8" />
                <span className="text-xl font-bold">
                  <span className="text-cheese">CHEESE</span>
                  <span className="text-foreground">Hub</span>
                </span>
              </div>
              <nav className="flex flex-col gap-1 p-3">
                {NAV_ITEMS.map((item) => (
                  <SheetClose key={item.to} asChild>
                    <Link to={item.to} className={navLinkClass(item.to)}>
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Link to="/" className="flex items-center gap-2">
            <img src={cheeseLogo} alt="Cheese Logo" className="h-7 w-7 sm:h-8 sm:w-8" />
            <span className="text-lg sm:text-xl font-bold">
              <span className="text-cheese">CHEESE</span>
              <span className="text-foreground">Hub</span>
            </span>
          </Link>

          {/* Desktop primary nav */}
          <nav className="hidden md:flex items-center gap-1">
            {PRIMARY_NAV.map((item) => (
              <Link key={item.to} to={item.to} className={navLinkClass(item.to)}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <WalletConnect />
          <Button
            variant="ghost"
            size="icon"
            className="relative hover:bg-primary/10 h-8 w-8 sm:h-9 sm:w-9"
            onClick={() => setIsOpen(true)}
          >
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-primary text-[10px] sm:text-xs font-bold text-primary-foreground">
                {totalItems}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Row 2: Secondary Nav (desktop only) */}
      <div className="container hidden md:flex h-10 items-center justify-center border-t border-border/30">
        <nav className="flex items-center gap-1">
          {SECONDARY_NAV.map((item) => (
            <Link key={item.to} to={item.to} className={navLinkClass(item.to)}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
