"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client";
import { useToast } from "../toast";
import { ActionButton } from "../action";
import { Field, cx, inputCls } from "../ui";
import type { GateResult } from "@/lib/kpi";

/* ---------------- screening checklist ---------------- */
export function ScreeningChecklist({ participantId, items, canEdit }: {
  participantId: string;
  items: { key: string; label: string; done: boolean; updatedAt: string | null; updatedBy: string | null; derived?: boolean; derivedOk?: boolean }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const toggle = async (key: string, done: boolean) => {
    setBusyKey(key);
    const res = await callApi(`/api/participants/${participantId}/screening`, "PATCH", { itemKey: key, done });
    setBusyKey(null);
    if (res.ok) {
      push("success", `Checklist updated: ${key} → ${done ? "done" : "undone"}.`);
      router.refresh();
    } else push("error", res.data.error ?? "Update failed.");
  };

  return (
    <ul className="divide-y divide-stone-100">
      {items.map((it) => (
        <li key={it.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <label className="flex flex-1 cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={it.derived ? it.derivedOk : it.done}
              disabled={!canEdit || !!it.derived || busyKey === it.key}
              onChange={(e) => void toggle(it.key, e.target.checked)}
              className="h-4 w-4 accent-[#8f1d22] disabled:opacity-50"
              aria-label={it.label}
            />
            <span className={cx("text-ink", it.derived && "text-ink-soft")}>{it.label}</span>
            {it.derived ? <span className="text-[10px] uppercase tracking-wide text-ink-mute">(auto from record)</span> : null}
          </label>
          <span className="text-[10px] text-ink-mute">{it.updatedBy ? `${it.updatedBy}${it.updatedAt ? " · " + it.updatedAt : ""}` : "—"}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- consent actions ---------------- */
export function ConsentActions({ participantId, status, version, canAct, canWithdraw, staffName }: {
  participantId: string; status: string; version: string; canAct: boolean; canWithdraw: boolean; staffName: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [language, setLanguage] = useState("Hindi");
  const [witness, setWitness] = useState("");
  const [comprehension, setComprehension] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!canAct) {
    return <p className="px-4 py-3 text-xs text-ink-mute">Consent actions are performed by the site Coordinator. You have read-only view.</p>;
  }
  if (status === "ACCEPTED") {
    return (
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <ActionButton url={`/api/participants/${participantId}/consent`} body={{ action: "withdraw" }} label="Withdraw consent" variant="danger"
          reason="Reason for withdrawing consent (kept in history)" confirm="Withdraw consent? The record history is preserved and the enrollment gate will block enrollment." success="Consent withdrawn." disabled={!canWithdraw} disabledReason="Only Coordinator or PI may withdraw consent." />
        <span className="text-[11px] text-ink-mute">Withdrawal keeps full history visible.</span>
      </div>
    );
  }
  if (status === "DECLINED") {
    return <p className="px-4 py-3 text-xs text-ink-soft">Consent was declined. Participant cannot be enrolled unless a new consent discussion is recorded.</p>;
  }

  const accept = async () => {
    setErr(null);
    if (!comprehension) { setErr('Confirm "Language and comprehension" before accepting.'); return; }
    setBusy(true);
    const res = await callApi(`/api/participants/${participantId}/consent`, "POST", { action: "accept", language, witness: witness || null });
    setBusy(false);
    if (res.ok) { push("success", "Consent accepted — enrollment gate recomputed."); router.refresh(); }
    else push("error", res.data.error ?? "Failed.");
  };

  return (
    <div className="space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Consent version" htmlFor="cv">
          <input id="cv" value={version} readOnly className={`${inputCls} bg-stone-50`} />
        </Field>
        <Field label="Language" htmlFor="clang">
          <select id="clang" value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
            <option>English</option><option>Hindi</option><option>Marathi</option>
          </select>
        </Field>
        <Field label="Recording staff" htmlFor="cstaff">
          <input id="cstaff" value={staffName} readOnly className={`${inputCls} bg-stone-50`} />
        </Field>
        <Field label="Witness (optional)" htmlFor="cwit" hint="Impartial witness name, if applicable">
          <input id="cwit" value={witness} onChange={(e) => setWitness(e.target.value)} className={inputCls} placeholder="e.g., R. Kulkarni (site staff)" />
        </Field>
      </div>
      <label className="flex items-start gap-2 text-xs text-ink-soft">
        <input type="checkbox" checked={comprehension} onChange={(e) => setComprehension(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#8f1d22]" />
        Language and comprehension confirmed with the participant (required).
      </label>
      {err ? <p className="text-xs font-medium text-danger" role="alert">{err}</p> : null}
      <p className="text-[11px] text-ink-mute">Signature is <strong>simulated</strong> — this demo does not claim legal e-signature validity.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void accept()} disabled={busy}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-60">
          {busy ? "Saving…" : "Accept consent"}
        </button>
        <ActionButton url={`/api/participants/${participantId}/consent`} body={{ action: "decline" }} label="Decline" variant="danger"
          reason="Reason for declining consent" success="Consent declined and recorded." />
      </div>
    </div>
  );
}

/* ---------------- enrollment gate actions ---------------- */
export function EnrollGateActions({ participantId, gate, canEnroll, code, siteId }: {
  participantId: string; gate: GateResult; canEnroll: boolean; code: string; siteId: string;
}) {
  const { push } = useToast();
  const [dupCode, setDupCode] = useState("");
  const [busy, setBusy] = useState(false);

  const checkDuplicate = async () => {
    if (!dupCode.trim()) return;
    setBusy(true);
    const res = await callApi(`/api/participants/${participantId}/enroll`, "POST", { checkOnly: true, subjectCode: dupCode.trim().toUpperCase(), siteId });
    setBusy(false);
    if (res.ok) push("info", res.data.message as string);
    else push("error", res.data.error ?? "Check failed.");
  };

  return (
    <div className="space-y-3 p-4">
      {gate.state === "ENROLLED" || gate.state === "READY" || gate.state === "BLOCKED" ? null : null}
      {canEnroll ? (
        <ActionButton
          url={`/api/participants/${participantId}/enroll`}
          body={{ siteId }}
          label="Enroll Participant"
          variant="primary"
          success={`${code} enrolled — KPIs, queues and audit updated.`}
          confirm={`Enroll ${code} into AIIA-AYU-026-DEMO?`}
          disabled={gate.state !== "READY"}
          disabledReason={gate.state === "ENROLLED" ? "Already enrolled." : "Enrollment gate is blocked — resolve the blockers first."}
        />
      ) : (
        <ActionButton label="Enroll Participant" variant="primary" disabled disabledReason="Only the site Coordinator may enroll participants." />
      )}

      <div className="rounded-md border border-stone-200 bg-stone-50 p-3">
        <p className="text-xs font-semibold text-ink-soft">Duplicate subject-code check (demo)</p>
        <p className="mt-0.5 text-[11px] text-ink-mute">Enter any existing code (e.g., AYU-0001) to see the server reject a duplicate enrollment.</p>
        <div className="mt-2 flex gap-2">
          <input value={dupCode} onChange={(e) => setDupCode(e.target.value)} placeholder="AYU-0001" aria-label="Subject code to check"
            className={`${inputCls} max-w-[180px] font-mono uppercase`} />
          <button type="button" onClick={() => void checkDuplicate()} disabled={busy}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-ink hover:bg-stone-50 disabled:opacity-60">
            Check code
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- new screening participant ---------------- */
export function NewParticipantForm({ sites }: { sites: { id: string; name: string }[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [code, setCode] = useState("");
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setErr(null);
        const res = await callApi("/api/participants", "POST", { code: code.toUpperCase(), siteId });
        setBusy(false);
        if (res.ok) { push("success", "Screening record created."); setCode(""); router.refresh(); }
        else if (res.status === 409) setErr(res.data.error ?? "Duplicate subject code.");
        else setErr(res.data.error ?? "Failed.");
      }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Subject code (synthetic)" htmlFor="npc" hint="Format AYU-#### — coded identity only, never names/contact details." required error={err}>
          <input id="npc" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AYU-0027" className={`${inputCls} font-mono`} required />
        </Field>
        <Field label="Site" htmlFor="nps" required>
          <select id="nps" value={siteId} onChange={(e) => setSiteId(e.target.value)} className={inputCls}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
      </div>
      <button type="submit" disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        {busy ? "Creating…" : "Create screening record"}
      </button>
    </form>
  );
}
