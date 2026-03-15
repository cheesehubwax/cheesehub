import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ChartLine, 
  TwitterLogo, 
  TelegramLogo,
  DiscordLogo,
  GithubLogo
} from '@phosphor-icons/react';

interface QuickLinkProps {
  icon: React.ReactNode;
  label: string;
  href: string;
  variant?: 'default' | 'social';
}

function QuickLink({ icon, label, href, variant = 'default' }: QuickLinkProps) {
  const baseStyles = "flex items-center gap-2 transition-all duration-200";
  const variantStyles = variant === 'social' 
    ? "text-primary hover:text-primary/80" 
    : "bg-card hover:bg-cheese/10 border border-border/50 hover:border-cheese/30";

  return (
    <Button
      asChild
      variant={variant === 'social' ? 'ghost' : 'outline'}
      size={variant === 'social' ? 'icon' : 'default'}
      className={`${baseStyles} ${variantStyles}`}
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        {icon}
        {variant !== 'social' && <span>{label}</span>}
      </a>
    </Button>
  );
}

export function QuickLinksSection() {
  return (
    <Card className="bg-card/50 border-border/50 backdrop-blur-sm">
      <CardContent className="py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Trading Links */}
          <div className="flex flex-wrap justify-center gap-3">
            <QuickLink
              icon={<ChartLine size={18} weight="bold" />}
              label="View Chart"
              href="https://www.dextools.io/app/en/wax/pair-explorer/0xcheeseburger"
            />
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">Join the community:</span>
            <QuickLink
              icon={<TwitterLogo size={20} weight="fill" />}
              label="Twitter"
              href="https://twitter.com/cheeseonwax"
              variant="social"
            />
            <QuickLink
              icon={<TelegramLogo size={20} weight="fill" />}
              label="Telegram"
              href="https://t.me/cheeseonwax"
              variant="social"
            />
            <QuickLink
              icon={<DiscordLogo size={20} weight="fill" />}
              label="Discord"
              href="https://discord.gg/cheeseonwax"
              variant="social"
            />
            <QuickLink
              icon={<GithubLogo size={20} weight="fill" />}
              label="GitHub"
              href="https://github.com/cheeseonwax"
              variant="social"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
