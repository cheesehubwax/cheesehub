import { XLogo, TelegramLogo } from "@phosphor-icons/react";

export function Footer() {
  return (
    <footer className="border-t border-border/50 py-8">
      <div className="container text-center text-sm text-muted-foreground">
        <div className="flex justify-center gap-4 mb-4">
          <a
            href="https://x.com/cheesetoken"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-cheese transition-colors"
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
        <p>
          <span className="text-cheese">CHEESE</span>
          <span className="text-foreground">Hub</span> • Built on WAX • Powered by $CHEESE, WaxDAO and NFTHive Smart Contracts
        </p>
      </div>
    </footer>
  );
}
