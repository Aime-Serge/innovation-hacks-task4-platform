"use client";

import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ToastItem } from "./ToastLayer";

// The Radix toast code loads with the first toast, not with every page (NFR-04).
// It also means the viewport, whose wrapper carries an inline style the strict
// CSP forbids in server HTML, is never part of the server-rendered page.
const ToastLayer = lazy(() => import("./ToastLayer"));

type ToastApi = { notify: (tone: ToastItem["tone"], message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) throw new Error("useToast must be used inside ToastProvider");
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const notify = useCallback((tone: ToastItem["tone"], message: string) => {
    setItems((current) => [...current, { id: Date.now() + Math.random(), tone, message }]);
  }, []);
  const close = useCallback((id: number) => {
    setItems((current) => current.filter((entry) => entry.id !== id));
  }, []);
  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {items.length > 0 && (
        <Suspense fallback={null}>
          <ToastLayer items={items} onClose={close} />
        </Suspense>
      )}
    </ToastContext.Provider>
  );
}
