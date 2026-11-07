import './index.css';
import { createRoot } from 'react-dom/client';
import { CryptTrustBadge, CryptTrustContext } from '@/components/crypt/CryptTrustBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Temporary harness: own Respect badge inside a Members-style dropdown, plus standalone. */
function App() {
  return <CryptTrustContext.Provider value="alice">
    <div className="dark min-h-screen bg-background p-8 text-foreground space-y-8">
      <Popover>
        <PopoverTrigger asChild><button type="button" id="members-btn" className="rounded border px-3 py-1">👥 Members (2)</button></PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-2">
          <ul className="space-y-1">
            <li className="flex items-center gap-2"><span className="text-xs font-semibold">alice (you)</span><CryptTrustBadge account="alice" variant="inline" /></li>
            <li className="flex items-center gap-2"><span className="text-xs font-semibold">bob</span><CryptTrustBadge account="bob" variant="inline" /></li>
          </ul>
        </PopoverContent>
      </Popover>
      <div id="standalone"><CryptTrustBadge account="alice" variant="inline" /></div>
    </div>
  </CryptTrustContext.Provider>;
}

createRoot(document.getElementById('root')!).render(<App />);
