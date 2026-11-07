import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CryptTrustBadge, CryptTrustContext } from '@/components/crypt/CryptTrustBadge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

vi.mock('@/hooks/useCryptTrust', () => ({ useCryptTrust: () => null }));

const selfBadge = (variant?: 'inline' | 'stacked') =>
  render(<CryptTrustContext.Provider value="alice"><CryptTrustBadge account="alice" variant={variant} /></CryptTrustContext.Provider>);

describe('Own Respect badge opens the points checklist', () => {
  it('opens the breakdown popover when clicking your own stacked badge', async () => {
    selfBadge('stacked');
    await userEvent.click(screen.getByRole('button', { name: 'Your Respect breakdown' }));
    expect(await screen.findByText('Your Respect')).toBeTruthy();
  });

  it('opens the breakdown popover when clicking your own inline badge', async () => {
    selfBadge('inline');
    await userEvent.click(screen.getByRole('button', { name: 'Your Respect breakdown' }));
    expect(await screen.findByText('Your Respect')).toBeTruthy();
  });

  it('opens the breakdown from inside an open Members dropdown (nested popover)', async () => {
    render(<CryptTrustContext.Provider value="alice">
      <Popover open>
        <PopoverTrigger asChild><button type="button">👥 Members</button></PopoverTrigger>
        <PopoverContent><ul><li><CryptTrustBadge account="alice" variant="inline" /></li></ul></PopoverContent>
      </Popover>
    </CryptTrustContext.Provider>);
    await userEvent.click(screen.getByRole('button', { name: 'Your Respect breakdown' }));
    expect(await screen.findByText('Your Respect')).toBeTruthy();
  });

  it('never opens the breakdown for someone else', async () => {
    render(<CryptTrustContext.Provider value="alice"><CryptTrustBadge account="bob" variant="inline" /></CryptTrustContext.Provider>);
    expect(screen.queryByRole('button', { name: 'Your Respect breakdown' })).toBeNull();
  });
});
