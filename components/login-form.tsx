"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client";
import { inputCls } from "./ui";

const DEMO_ROLES: [string, string, string][] = [
  ["PI", "pi@demo.local", "Dr. Arjun Rao"],
  ["COORDINATOR", "coordinator@demo.local", "Priya Nair"],
  ["MONITOR", "monitor@demo.local", "Vikram Desai"],
  ["PV_OFFICER", "pv@demo.local", "Dr. Meera Iyer"],
  ["ETHICS_MEMBER", "ethics@demo.local", "Dr. S. Kulkarni"],
  ["LEADERSHIP", "leadership@demo.local", "Anita Sharma"],
  ["ADMIN", "admin@demo.local", "System Admin"],
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("coordinator@demo.local");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async (payload: Record<string, string>) => {
    setBusy(true);
    setError(null);
    const res = await callApi("/api/auth/login", "POST", payload);
    setBusy(false);
    if (res.ok) router.push("/overview");
    else setError(res.data.error ?? "Sign-in failed.");
  };

  return (
    <div className="w-full max-w-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void signIn({ email, password });
        }}
        className="rounded-lg border border-stone-200 bg-white p-5 shadow-card">
        <div className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-semibold text-ink-soft">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} required />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-semibold text-ink-soft">Password</label>
            <input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} required />
          </div>
          {error ? <p className="rounded-md border border-danger-line bg-danger-bg px-2.5 py-1.5 text-xs font-medium text-danger" role="alert">{error}</p> : null}
          <button type="submit" disabled={busy}
            className="w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-[11px] text-ink-mute">Demo environment · any account · password <code className="rounded bg-stone-100 px-1">demo1234</code></p>
        </div>
      </form>

      <div className="mt-4 rounded-lg border border-stone-200 bg-white p-4 shadow-card">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-mute">Demo login — one click per role</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {DEMO_ROLES.map(([role, mail, name]) => (
            <button key={role} type="button" disabled={busy} onClick={() => void signIn({ role })}
              className="rounded-md border border-stone-200 px-2.5 py-1.5 text-left text-xs hover:border-brand/40 hover:bg-brand-tint focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60">
              <span className="block font-semibold text-ink">{roleLabel(role)}</span>
              <span className="block text-[11px] text-ink-mute">{name} · {mail}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function roleLabel(r: string) {
  const m: Record<string, string> = {
    PI: "Login as PI", COORDINATOR: "Login as Coordinator", MONITOR: "Login as Monitor",
    PV_OFFICER: "Login as PV Officer", ETHICS_MEMBER: "Login as Ethics Member",
    LEADERSHIP: "Login as Leadership", ADMIN: "Login as Admin",
  };
  return m[r] ?? r;
}
