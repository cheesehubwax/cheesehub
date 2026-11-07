import { createContext } from 'react';
import type { WaxContextType } from './WaxContext';

// Kept outside the Fast Refresh boundary so retained providers and refreshed
// consumers always refer to the same context object.
export const WaxContext = createContext<WaxContextType | undefined>(undefined);