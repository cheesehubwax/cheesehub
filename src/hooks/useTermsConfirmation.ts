import { useState, useCallback, useRef } from "react";

const STORAGE_KEY = "terms_accepted";

export function useTermsConfirmation() {
  const [isOpen, setIsOpen] = useState(false);
  const pendingCallback = useRef<(() => void) | null>(null);

  const requireTerms = useCallback((callback: () => void) => {
    if (sessionStorage.getItem(STORAGE_KEY) === "true") {
      callback();
      return;
    }
    pendingCallback.current = callback;
    setIsOpen(true);
  }, []);

  const handleConfirm = useCallback(() => {
    sessionStorage.setItem(STORAGE_KEY, "true");
    setIsOpen(false);
    pendingCallback.current?.();
    pendingCallback.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    pendingCallback.current = null;
  }, []);

  return {
    requireTerms,
    termsDialogProps: {
      open: isOpen,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
  };
}
