"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { callApi } from "@/lib/client";
import { cx } from "./ui";

interface StepVm { id: number; title: string; detail: string; href: string; roleHint: string; done: boolean }

export function JudgePanel({ canAct }: { canAct: boolean }) {
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<StepVm[]>([]);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const refresh = useCallback(async () => {
    const res = await callApi("/api/judge/progress", "GET");
    if (res.ok) {
      setSteps(res.data.steps as StepVm[]);
      setStartedAt((res.data.startedAt as string | null) ?? null);
    }
  }, []);

  // record navigation + refresh progress on route change
  useEffect(() => {
    if (!canAct) return;
    void callApi("/api/judge/progress", "POST", { path: pathname }).then(refresh);
  }, [pathname, refresh, canAct]);

  // poll while open
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [open, refresh]);

  if (!canAct) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-pop hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
        <span aria-hidden>▶</span> Judge Demo
        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">{doneCount}/12</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[65]" role="dialog" aria-modal="true" aria-label="Judge demo walkthrough">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 right-0 flex w-[min(94vw,420px)] animate-slidein flex-col border-l border-stone-200 bg-white shadow-pop">
            <div className="border-b border-stone-200 px-4 py-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-ink">Judge Demo — 90-second walkthrough</h2>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded p-1 text-ink-mute hover:bg-stone-100">✕</button>
              </div>
              <p className="mt-1 text-[11px] text-ink-mute">
                {startedAt ? `Scenario started ${new Date(startedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })} IST — steps auto-tick as the system state changes.` : "Steps auto-tick as the system state changes."} Switch roles via the user menu (sign out → role login).
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-stone-100" role="img" aria-label={`${doneCount} of 12 steps done`}>
                <div className="h-full bg-ok transition-all" style={{ width: `${(doneCount / 12) * 100}%` }} />
              </div>
            </div>
            <ol className="flex-1 divide-y divide-stone-100 overflow-y-auto">
              {steps.map((s) => (
                <li key={s.id} className={cx("flex gap-3 px-4 py-3", s.done && "bg-ok-bg/60")}>
                  <span aria-hidden className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    s.done ? "bg-ok text-white" : "bg-stone-200 text-ink-mute")}>
                    {s.done ? "✓" : s.id}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-ink">{s.title} <span className="ml-1 font-normal text-ink-mute">({s.roleHint})</span></p>
                    <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{s.detail}</p>
                    <Link href={s.href} onClick={() => setOpen(false)}
                      className="mt-1.5 inline-block rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
                      Go →
                    </Link>
                  </div>
                </li>
              ))}
            </ol>
            <div className="border-t border-stone-200 px-4 py-2.5">
              <p className="text-[10px] leading-snug text-ink-mute">
                Demo tip: after enrolling AYU-0025, watch the Overview KPIs (Enrolled 24→25) and the Audit trail update instantly. Reset data in Settings (Admin).
              </p>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
