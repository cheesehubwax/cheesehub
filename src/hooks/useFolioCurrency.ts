// CHEESEFolio display currency: a crypto picker (WAX/BTC/ETH) or a fiat picker,
// only one active at a time, remembered in this browser.
import { useState } from 'react';
import { isCrypto, isFiat, type CryptoCode, type DisplayCode, type FiatCode } from '@/lib/folio/fxCore';

export type CryptoChoice = 'WAX' | CryptoCode;

const read = (key: string) => {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) ?? '' : ''; } catch { return ''; }
};
const write = (pairs: [string, string][]) => {
  try { for (const [k, v] of pairs) localStorage.setItem(k, v); } catch { /* private mode */ }
};

export function useFolioCurrency() {
  const [stored] = useState(() => read('cheesefolio-currency'));
  const [mode, setMode] = useState<'CRYPTO' | 'FIAT'>(() => (!stored || stored === 'WAX' || isCrypto(stored) ? 'CRYPTO' : 'FIAT'));
  const [chosenCrypto, setChosenCrypto] = useState<CryptoChoice>(() => (isCrypto(stored) ? stored : 'WAX'));
  const [chosenFiat, setChosenFiat] = useState<FiatCode>(() => {
    const f = read('cheesefolio-fiat') || stored;
    return isFiat(f) ? f : 'USD';
  });
  /** Currency whose history the ledger needs; WAX itself needs none, so fiat stays loaded. */
  const activeCode: DisplayCode = mode === 'CRYPTO' && chosenCrypto !== 'WAX' ? chosenCrypto : chosenFiat;
  const showCrypto = (c: CryptoChoice) => {
    setMode('CRYPTO');
    setChosenCrypto(c);
    write([['cheesefolio-currency', c]]);
  };
  const showFiat = (f: FiatCode) => {
    setMode('FIAT');
    setChosenFiat(f);
    write([['cheesefolio-currency', f], ['cheesefolio-fiat', f]]);
  };
  return { mode, chosenCrypto, chosenFiat, activeCode, showCrypto, showFiat };
}
