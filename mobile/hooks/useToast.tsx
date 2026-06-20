import React, { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastTone = "success" | "error" | "info";

type ToastMessage = {
  id: string;
  tone: ToastTone;
  text: string;
};

type ToastContextValue = {
  toasts: ToastMessage[];
  pushToast: (text: string, tone?: ToastTone) => void;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const activeToastKeys = useRef(new Set<string>());
  const toastKeysById = useRef(new Map<string, string>());

  const removeToast = useCallback((id: string) => {
    const key = toastKeysById.current.get(id);
    if (key) {
      activeToastKeys.current.delete(key);
      toastKeysById.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (text: string, tone: ToastTone = "info") => {
      const key = text.trim();
      if (!key || activeToastKeys.current.has(key)) return;

      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const message = { id, tone, text };
      activeToastKeys.current.add(key);
      toastKeysById.current.set(id, key);
      setToasts((prev) => [...prev, message]);
    },
    []
  );

  const value = useMemo(() => ({ toasts, pushToast, removeToast }), [toasts, pushToast, removeToast]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
