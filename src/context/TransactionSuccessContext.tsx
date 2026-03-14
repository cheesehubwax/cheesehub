import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { TransactionSuccessDialog } from '@/components/wallet/TransactionSuccessDialog';

interface TransactionSuccessState {
  open: boolean;
  title: string;
  description: string;
  txId: string | null;
}

interface TransactionSuccessContextType {
  showSuccess: (title: string, description: string, txId?: string | null) => void;
}

const TransactionSuccessContext = createContext<TransactionSuccessContextType | null>(null);

export function TransactionSuccessProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TransactionSuccessState>({
    open: false, title: '', description: '', txId: null,
  });

  const showSuccess = useCallback((title: string, description: string, txId?: string | null) => {
    setState({ open: true, title, description, txId: txId ?? null });
  }, []);

  return (
    <TransactionSuccessContext.Provider value={{ showSuccess }}>
      {children}
      <TransactionSuccessDialog
        open={state.open}
        onOpenChange={(open) => setState(s => ({ ...s, open }))}
        title={state.title}
        description={state.description}
        txId={state.txId}
      />
    </TransactionSuccessContext.Provider>
  );
}

export function useTransactionSuccess() {
  const ctx = useContext(TransactionSuccessContext);
  if (!ctx) throw new Error('useTransactionSuccess must be used within TransactionSuccessProvider');
  return ctx;
}
