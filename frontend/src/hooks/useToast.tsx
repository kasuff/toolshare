import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

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

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (text: string, tone: ToastTone = "info") => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const message = { id, tone, text };
      setToasts((prev) => [...prev, message]);
      window.setTimeout(() => removeToast(id), 3500);
    },
    [removeToast]
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
