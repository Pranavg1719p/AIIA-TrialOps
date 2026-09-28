"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type Kind = "success" | "error" | "info";
interface Toast { id: number; kind: Kind; msg: string }

const ToastCtx = createContext<{ push: (kind: Kind, msg: string) => void }>({ push: () => {} });

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const push = useCallback((kind: Kind, msg: string) => {
    seq.current += 1;
    const id = seq.current;
    setToasts((t) => [...t.slice(-3), { id, kind, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4600);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto animate-slidein rounded-md border px-3.5 py-2.5 text-sm shadow-pop ${
              t.kind === "success" ? "border-ok-line bg-ok-bg text-ok"
              : t.kind === "error" ? "border-danger-line bg-danger-bg text-danger"
              : "border-stone-300 bg-white text-ink"}`}
            role="status">
            <span aria-hidden className="mr-1.5 font-semibold">{t.kind === "success" ? "✓" : t.kind === "error" ? "✕" : "ℹ"}</span>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
