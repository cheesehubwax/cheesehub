import { XLogo, TelegramLogo } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { Megaphone } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 py-8">
      <div className="container text-center text-sm text-muted-foreground">
        <div className="flex justify-center gap-4 mb-4">
          <a
            href="https://x.com/cheesetoken"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:text-primary/80 transition-colors"
          >
            <XLogo size={24} weight="fill" />
          </a>
          <a
            href="https://t.me/cheeseonwaxofficial"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-cheese transition-colors"
          >
            <TelegramLogo size={24} weight="fill" />
          </a>
        </div>
        <Link
          to="/bannerads"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-cheese transition-colors mb-3"
        >
          <Megaphone className="h-3.5 w-3.5" />
          Advertise with CHEESEHub
        </Link>
        <div className="flex justify-center gap-4 mb-3">
          <Link to="/disclaimer" className="text-muted-foreground hover:text-cheese transition-colors">
            Disclaimer
          </Link>
          <span className="text-muted-foreground">•</span>
          <Link to="/terms" className="text-muted-foreground hover:text-cheese transition-colors">
            Terms of Use
          </Link>
        </div>
        <p>
          <span className="text-cheese">CHEESE</span>
          <span className="text-foreground">Hub</span> • Built on WAX • Powered by $CHEESE, WaxDAO and NFTHive Smart Contracts
        </p>
      </div>
    </footer>
  );
}
