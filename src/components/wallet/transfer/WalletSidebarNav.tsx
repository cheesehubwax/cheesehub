import { memo } from 'react';
import {
  Wallet,
  Send,
  Image,
  Landmark,
  Zap,
  HardDrive,
  Vote,
  Gift,
  UserPlus,
  Sprout,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type WalletSection =
  | 'account'
  | 'send-tokens'
  | 'send-nfts'
  | 'stake'
  | 'rent'
  | 'ram'
  | 'governance'
  | 'vote-rewards'
  | 'create-account'
  | 'alcor-farms'
  | 'unbox-wojak';

interface SidebarItem {
  id: WalletSection;
  label: string;
  icon: React.ElementType;
  bottom?: boolean;
}

export const SIDEBAR_ITEMS: SidebarItem[] = [
  { id: 'account', label: 'Account', icon: Wallet },
  { id: 'send-tokens', label: 'Send Tokens', icon: Send },
  { id: 'send-nfts', label: 'Send NFTs', icon: Image },
  { id: 'stake', label: 'Stake CPU/NET', icon: Landmark },
  { id: 'rent', label: 'Rent CPU/NET', icon: Zap },
  { id: 'ram', label: 'Trade RAM', icon: HardDrive },
  { id: 'governance', label: 'Governance', icon: Vote },
  { id: 'vote-rewards', label: 'Vote Rewards', icon: Gift },
  { id: 'create-account', label: 'Create Account', icon: UserPlus },
  { id: 'alcor-farms', label: 'Manage Alcor Farms', icon: Sprout, bottom: true },
  { id: 'unbox-wojak', label: 'Open Wojak Pack', icon: Package, bottom: true },
];

const TOP_ITEMS = SIDEBAR_ITEMS.filter((i) => !i.bottom);
const BOTTOM_ITEMS = SIDEBAR_ITEMS.filter((i) => i.bottom);

function SidebarButton({ item, isActive, onSelect }: { item: SidebarItem; isActive: boolean; onSelect: (id: WalletSection) => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={() => onSelect(item.id)}
      className={cn(
        'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors text-left',
        isActive
          ? 'bg-primary/20 text-primary border-r-2 border-primary font-medium'
          : 'text-foreground hover:bg-muted/50'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

/** Left-hand section list of the CHEESEWallet dialog. */
export const WalletSidebarNav = memo(function WalletSidebarNav({
  activeSection,
  onSelect,
}: {
  activeSection: WalletSection;
  onSelect: (id: WalletSection) => void;
}) {
  return (
    <div className="w-[180px] shrink-0 border-r border-border flex flex-col">
      <nav className="flex-1 py-2 space-y-1.5">
        {TOP_ITEMS.map((item) => (
          <SidebarButton key={item.id} item={item} isActive={activeSection === item.id} onSelect={onSelect} />
        ))}
      </nav>
      {BOTTOM_ITEMS.length > 0 && (
        <div className="border-t border-border py-2">
          {BOTTOM_ITEMS.map((item) => (
            <SidebarButton key={item.id} item={item} isActive={activeSection === item.id} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
});
