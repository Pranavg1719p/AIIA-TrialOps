"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client";
import { useToast } from "./toast";
import { inputCls } from "./ui";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-dark border-brand",
  secondary: "bg-white text-ink border-stone-300 hover:bg-stone-50",
  danger: "bg-white text-danger border-danger-line hover:bg-danger-bg",
  ghost: "bg-transparent text-ink-soft border-transparent hover:bg-stone-100",
};

export function ActionButton({
  url, body, method = "POST", label, variant = "secondary", confirm, reason,
  success, disabled, disabledReason, small, className, quiet,
}: {
  url?: string;
  body?: Record<string, unknown>;
  method?: string;
  label: string;
  variant?: Variant;
  confirm?: string;
  /** when set, a textarea modal collects a mandatory reason before submitting */
  reason?: string;
  success?: string;
  disabled?: boolean;
  disabledReason?: string;
  small?: boolean;
  className?: string;
  quiet?: boolean; // no success toast
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [askReason, setAskReason] = useState(false);

  const run = async (extra: Record<string, unknown> = {}) => {
    if (!url) return;
    setBusy(true);
    const res = await callApi(url, method, { ...(body ?? {}), ...extra });
    setBusy(false);
    if (res.ok) {
      if (!quiet && success !== null) push("success", success ?? `${label} — done.`);
      router.refresh();
    } else {
      push("error", res.data.error ?? "Action failed.");
    }
  };

  if (disabled) {
    return (
      <span title={disabledReason ?? "Not available for your role."} className={className}>
        <button type="button" disabled aria-disabled="true"
          className={`cursor-not-allowed rounded-md border border-stone-200 bg-stone-50 font-medium text-stone-400 ${small ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${className ?? ""}`}>
          {label}
        </button>
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        title={disabledReason}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          if (reason) setAskReason(true);
          else void run();
        }}
        className={`inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60 ${variants[variant]} ${small ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${className ?? ""}`}>
        {busy ? "Working…" : label}
      </button>
      {askReason ? (
        <ReasonModal
          title={reason!}
          busy={busy}
          onCancel={() => setAskReason(false)}
          onSubmit={(text) => {
            void run({ reason: text }).then(() => setAskReason(false));
          }}
        />
      ) : null}
    </>
  );
}

export function ReasonModal({ title, onSubmit, onCancel, busy, hint }: {
  title: string; onSubmit: (text: string) => void; onCancel: () => void; busy?: boolean; hint?: string;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4 animate-fadein" onClick={onCancel}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md rounded-lg border border-stone-200 bg-white p-4 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {hint ? <p className="mt-1 text-xs text-ink-mute">{hint}</p> : null}
        <textarea ref={ref} value={text} onChange={(e) => setText(e.target.value)} rows={3} required
          placeholder="State the reason — it is written to the audit trail"
          className={`${inputCls} mt-3`} aria-label="Reason" />
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-stone-50">Cancel</button>
          <button type="button" disabled={busy || !text.trim()} onClick={() => onSubmit(text.trim())}
            className="rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
            {busy ? "Saving…" : "Confirm with reason"}
          </button>
        </div>
      </div>
    </div>
  );
}
