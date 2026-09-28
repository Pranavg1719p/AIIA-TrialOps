"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { callApi } from "@/lib/client";
import { cx } from "./ui";

export interface NotiVm { id: string; title: string; body: string; link: string; at: string; read: boolean }

export function Topbar({ user, trialCode, scopeLabel, notifications }: {
  user: { name: string; role: string; email: string };
  trialCode: string;
  scopeLabel: string;
  notifications: NotiVm[];
}) {
  const router = useRouter();
  const [openBell, setOpenBell] = useState(false);
  const [openUser, setOpenUser] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) {
        setOpenBell(false);
        setOpenUser(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const signOut = async () => {
    await callApi("/api/auth/logout", "POST");
    window.location.href = "/";
  };

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4" ref={wrap}>
        <Link href="/overview" className="flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
          <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-[13px] font-bold text-white">आ</span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight text-ink">AIIA TrialOps</span>
            <span className="hidden text-[10px] text-ink-mute sm:block">One governed trial record. One connected workflow.</span>
          </span>
        </Link>

        <span className="ml-2 hidden items-center gap-1.5 rounded border border-warn-line bg-warn-bg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warn md:inline-flex" title="Synthetic demonstration system — not for clinical use">
          ▲ Demo Mode
        </span>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-ink-soft lg:inline" title="Active trial scope">
            Trial: <span className="font-semibold text-ink">{trialCode}</span>
          </span>
          <span className="hidden rounded-md border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] font-medium text-ink-soft xl:inline" title="Site scope">
            Site: <span className="font-semibold text-ink">{scopeLabel}</span>
          </span>

          <div className="relative">
            <button type="button" onClick={() => { setOpenBell(!openBell); setOpenUser(false); }}
              aria-expanded={openBell} aria-label={`Notifications (${unread} unread)`}
              className="relative rounded-md border border-stone-200 bg-white p-2 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
              {unread > 0 ? <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">{unread}</span> : null}
            </button>
            {openBell ? (
              <div className="absolute right-0 mt-2 w-[min(90vw,360px)] animate-fadein rounded-lg border border-stone-200 bg-white shadow-pop">
                <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
                  <p className="text-xs font-semibold text-ink">Notifications</p>
                  <button type="button" className="text-[11px] font-medium text-brand hover:underline"
                    onClick={async () => { await callApi("/api/notifications", "POST", { action: "readAll" }); router.refresh(); }}>
                    Mark all read
                  </button>
                </div>
                <ul className="max-h-80 divide-y divide-stone-100 overflow-y-auto">
                  {notifications.length === 0 ? <li className="px-3 py-6 text-center text-xs text-ink-mute">No notifications.</li> : null}
                  {notifications.map((n) => (
                    <li key={n.id}>
                      <Link href={n.link} onClick={() => setOpenBell(false)} className="block px-3 py-2.5 hover:bg-stone-50">
                        <p className={cx("text-xs", n.read ? "font-normal text-ink-soft" : "font-semibold text-ink")}>
                          {!n.read ? <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-brand align-middle" /> : null}{n.title}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-ink-mute">{n.body}</p>
                        <p className="mt-0.5 text-[10px] text-stone-400">{n.at}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button type="button" onClick={() => { setOpenUser(!openUser); setOpenBell(false); }}
              aria-expanded={openUser} aria-haspopup="menu"
              className="flex items-center gap-2 rounded-md border border-stone-200 bg-white px-2 py-1.5 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
              <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-ink-soft">{user.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}</span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-xs font-semibold text-ink">{user.name}</span>
                <span className="block text-[10px] text-ink-mute">{user.role.replace(/_/g, " ")}</span>
              </span>
            </button>
            {openUser ? (
              <div role="menu" className="absolute right-0 mt-2 w-56 animate-fadein rounded-lg border border-stone-200 bg-white p-1.5 shadow-pop">
                <p className="px-2.5 py-1.5 text-[11px] text-ink-mute">{user.email}</p>
                <Link href="/about" className="block rounded px-2.5 py-1.5 text-xs text-ink hover:bg-stone-50">About AIIA TrialOps</Link>
                {user.role === "ADMIN" ? <Link href="/settings" className="block rounded px-2.5 py-1.5 text-xs text-ink hover:bg-stone-50">Settings</Link> : null}
                <button type="button" role="menuitem" onClick={() => void signOut()} className="block w-full rounded px-2.5 py-1.5 text-left text-xs font-medium text-brand hover:bg-brand-tint">Sign out</button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
