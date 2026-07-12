import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { WalletConnect } from "./WalletConnect";
import { ShoppingCart, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useCart } from "@/context/CartContext";
import cheeseLogo from "@/assets/cheese-logo.png";
import waxLogoAsset from "@/assets/wax-logo.png.asset.json";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { to: "/", label: "Home", emoji: "🏠", prefix: "", suffix: "Home" },
  { to: "/powerup", label: "CHEESEUp", emoji: "⚡", prefix: "CHEESE", suffix: "Up" },
  { to: "/cheesenull", label: "CHEESENull", emoji: "⛔", prefix: "CHEESE", suffix: "Null" },
  { to: "/farm", label: "CHEESEFarm", emoji: "🌱", prefix: "CHEESE", suffix: "Farm" },
  { to: "/dao", label: "CHEESEDao", emoji: "🏛️", prefix: "CHEESE", suffix: "Dao" },
  { to: "/drip", label: "CHEESEDrip", emoji: "💧", prefix: "CHEESE", suffix: "Drip" },
  { to: "/locker", label: "CHEESELock", emoji: "🔐", prefix: "CHEESE", suffix: "Lock" },
  { to: "/drops", label: "CHEESEDrop", emoji: "🛒", prefix: "CHEESE", suffix: "Drop" },
];

function NavLabel({ item }: { item: typeof NAV_ITEMS[number] }) {
  if (!item.prefix) return <span>{item.suffix}</span>;
  return (
    <span>
      <span className="text-cheese">{item.prefix}</span>
      <span className="text-foreground">{item.suffix}</span>
    </span>
  );
}

const PRIMARY_NAV = NAV_ITEMS.slice(0, 6);
const SECONDARY_NAV = NAV_ITEMS.slice(6);

function BrandLink() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <img src={cheeseLogo} alt="Cheese Logo" className="h-7 w-7 sm:h-8 sm:w-8" />
      <span className="text-lg sm:text-xl font-bold">
        <span className="text-cheese">CHEESE</span>
        <span className="text-foreground">Hub</span>
      </span>
    </Link>
  );
}

function NavLink({ item }: { item: typeof NAV_ITEMS[number] }) {
  const location = useLocation();
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        location.pathname === item.to
          ? "bg-cheese/20 text-cheese"
          : "text-foreground hover:text-cheese hover:bg-muted"
      )}
    >
      <span>{item.emoji}</span>
      <NavLabel item={item} />
    </Link>
  );
}

export function Header() {
  const location = useLocation();
  const { totalItems, setIsOpen } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);

  const cartButton = location.pathname.startsWith("/drops") && (
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
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/60 backdrop-blur-xl">
      {/* Mobile header */}
      <div className="container flex md:hidden h-14 items-center justify-between">
        <div className="flex items-center gap-4">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
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
                    <NavLink item={item} />
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
          <BrandLink />
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <WalletConnect />
          {cartButton}
        </div>
      </div>

      {/* Desktop header */}
      <div className="container hidden md:grid grid-cols-[auto_1fr] items-stretch">
        {/* Brand column */}
        <div className="flex flex-col items-center justify-between py-2 pr-8">
          <BrandLink />
          <span className="text-sm font-script text-foreground/90">
            only on
          </span>
          <img
            src={waxLogoAsset.url}
            alt="WAX"
            className="h-10 w-auto object-contain"
          />
        </div>

        {/* Nav column */}
        <div className="flex flex-col justify-between">
          {/* Row 1: primary nav + actions */}
          <div className="flex h-16 items-center justify-end gap-2">
            <nav className="flex items-center gap-1">
              {PRIMARY_NAV.map((item) => (
                <NavLink key={item.to} item={item} />
              ))}
            </nav>
            <WalletConnect />
            {cartButton}
          </div>
          {/* Row 2: secondary nav */}
          <div className="flex h-10 items-center justify-center border-t border-border/30">
            <nav className="flex items-center gap-1">
              {SECONDARY_NAV.map((item) => (
                <NavLink key={item.to} item={item} />
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
