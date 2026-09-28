"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client";
import { useToast } from "../toast";
import { ActionButton } from "../action";
import { Field, inputCls } from "../ui";

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/* ---------------- report AE / SAE ---------------- */
export function SafetyEventForm({ participants }: { participants: { id: string; code: string }[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [f, setF] = useState({
    participantId: participants[0]?.id ?? "", term: "", narrative: "", onsetAt: todayLocal(),
    seriousness: "NON_SERIOUS", severity: "MILD", suspectedProduct: "AYU-Form-A (demo)",
    batch: "BATCH-2026-014", outcome: "",
  });
  const [criteria, setCriteria] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const toggleCriterion = (c: string) => setCriteria((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  return (
    <form className="space-y-3 p-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErrs({});
      const res = await callApi("/api/safety-events", "POST", { ...f, seriousnessCriteria: criteria });
      setBusy(false);
      if (res.ok) {
        push("success", (res.data as { message?: string }).message ?? "Safety event recorded.");
        router.refresh();
      } else if (res.status === 400 && res.data.errors) setErrs(res.data.errors as Record<string, string>);
      else push("error", res.data.error ?? "Save failed.");
    }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Participant (coded ID)" htmlFor="se-p" required error={errs.participantId}>
          <select id="se-p" value={f.participantId} onChange={(e) => set("participantId", e.target.value)} className={inputCls}>
            {participants.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        </Field>
        <Field label="Event term" htmlFor="se-t" required error={errs.term}>
          <input id="se-t" value={f.term} onChange={(e) => set("term", e.target.value)} placeholder="e.g., Fever (synthetic)" className={inputCls} />
        </Field>
        <Field label="Severity (human assessment)" htmlFor="se-sev" required>
          <select id="se-sev" value={f.severity} onChange={(e) => set("severity", e.target.value)} className={inputCls}>
            <option>MILD</option><option>MODERATE</option><option>SEVERE</option>
          </select>
        </Field>
        <Field label="Onset date" htmlFor="se-o" required error={errs.onsetAt}>
          <input id="se-o" type="date" max={todayLocal()} value={f.onsetAt} onChange={(e) => set("onsetAt", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Seriousness (human assessment)" htmlFor="se-ser" required>
          <select id="se-ser" value={f.seriousness} onChange={(e) => set("seriousness", e.target.value)} className={inputCls}>
            <option value="NON_SERIOUS">NON-SERIOUS</option>
            <option value="SERIOUS">SERIOUS</option>
          </select>
        </Field>
        <Field label="Suspected product / batch" htmlFor="se-pr" required>
          <div className="flex gap-2">
            <input value={f.suspectedProduct} onChange={(e) => set("suspectedProduct", e.target.value)} className={inputCls} aria-label="Suspected product" />
            <input value={f.batch} onChange={(e) => set("batch", e.target.value)} className={`${inputCls} max-w-[140px] font-mono`} aria-label="Batch" />
          </div>
        </Field>
      </div>
      {f.seriousness === "SERIOUS" ? (
        <fieldset className="rounded-md border border-danger-line bg-danger-bg p-3">
          <legend className="px-1 text-xs font-semibold text-danger">Seriousness criteria (select all that apply)</legend>
          <div className="flex flex-wrap gap-3 text-xs text-ink-soft">
            {["Hospitalisation", "Life-threatening", "Death", "Permanent disability", "Congenital anomaly"].map((c) => (
              <label key={c} className="flex items-center gap-1.5">
                <input type="checkbox" checked={criteria.includes(c)} onChange={() => toggleCriterion(c)} className="h-4 w-4 accent-[#8f1d22]" />
                {c}
              </label>
            ))}
          </div>
          {errs.seriousnessCriteria ? <p className="mt-1 text-[11px] font-medium text-danger">{errs.seriousnessCriteria}</p> : null}
        </fieldset>
      ) : null}
      <Field label="Narrative (required)" htmlFor="se-n" required error={errs.narrative} hint="Factual description. AI never determines causality, seriousness or diagnosis — humans do.">
        <textarea id="se-n" rows={3} value={f.narrative} onChange={(e) => set("narrative", e.target.value)} className={inputCls} />
      </Field>
      <Field label="Outcome (demo)" htmlFor="se-out" hint="Leave blank if ongoing; required before PV closure.">
        <input id="se-out" value={f.outcome} onChange={(e) => set("outcome", e.target.value)} className={inputCls} placeholder="e.g., Recovering (demo)" />
      </Field>
      <button type="submit" disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        {busy ? "Recording…" : "Record safety event"}
      </button>
    </form>
  );
}

/* ---------------- PV case actions ---------------- */
export function PvActions({ caseId, status, outcome, canPiReview, canPv }: {
  caseId: string; status: string; outcome: string; canPiReview: boolean; canPv: boolean;
}) {
  const base = "/api/safety-events";
  return (
    <div className="flex flex-wrap gap-2">
      {canPiReview && (status === "IDENTIFIED" || status === "PI_REVIEW_PENDING") ? (
        <ActionButton url={base} body={{ id: caseId, action: "piReview" }} label="PI review" small success="PI review recorded." />
      ) : null}
      {canPv ? (
        <>
          {status !== "CLOSED" && status !== "PV_IN_REVIEW" && status !== "FOLLOW_UP" ? (
            <ActionButton url={base} body={{ id: caseId, action: "review" }} label="Start PV review" small success="Case moved to IN REVIEW." />
          ) : null}
          {status !== "CLOSED" ? (
            <>
              <ActionButton url={base} body={{ id: caseId, action: "assignFollowUp", days: 3 }} label="Assign follow-up (+3d)" small success="Follow-up assigned — task due +3 days." />
              <ActionButton url={base} body={{ id: caseId, action: "addFollowUp" }} label="Add follow-up note" small reason="Follow-up note for the case file" success="Follow-up note added." />
              <ActionButton url={base} body={{ id: caseId, action: "close" }} label="Close case" small variant="danger"
                confirm="Close this safety case? Completeness is validated server-side."
                reason="Closure rationale (completeness is validated before closing)" success="Case closed." />
            </>
          ) : (
            <span className="text-[11px] text-ink-mute">Case closed{outcome ? ` — outcome: ${outcome}` : ""}.</span>
          )}
        </>
      ) : null}
      {!canPiReview && !canPv ? <span className="text-[11px] text-ink-mute">Read-only for your role.</span> : null}
    </div>
  );
}

/* ---------------- monitoring: finding + query ---------------- */
export function FindingForm({ sites, participants, defaultSiteId }: {
  sites: { id: string; name: string }[]; participants: { id: string; code: string }[]; defaultSiteId?: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [f, setF] = useState({ siteId: defaultSiteId ?? sites[0]?.id ?? "", participantId: "", severity: "MINOR", description: "", sourceContext: "" });
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <form className="space-y-3 p-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErrs({});
      const res = await callApi("/api/monitoring", "POST", { ...f, participantId: f.participantId || null });
      setBusy(false);
      if (res.ok) { push("success", "Monitoring finding recorded."); router.refresh(); }
      else if (res.status === 400 && res.data.errors) setErrs(res.data.errors as Record<string, string>);
      else push("error", res.data.error ?? "Save failed.");
    }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Site" htmlFor="mf-s" required hint={defaultSiteId ? "Monitors are scoped to assigned sites." : undefined}>
          <select id="mf-s" value={f.siteId} onChange={(e) => set("siteId", e.target.value)} className={inputCls} disabled={!!defaultSiteId}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Participant (optional)" htmlFor="mf-p">
          <select id="mf-p" value={f.participantId} onChange={(e) => set("participantId", e.target.value)} className={inputCls}>
            <option value="">— site-level finding —</option>
            {participants.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        </Field>
        <Field label="Severity" htmlFor="mf-sev" required>
          <select id="mf-sev" value={f.severity} onChange={(e) => set("severity", e.target.value)} className={inputCls}>
            <option>MINOR</option><option>MAJOR</option><option>NOTE</option>
          </select>
        </Field>
      </div>
      <Field label="Description" htmlFor="mf-d" required error={errs.description}>
        <textarea id="mf-d" rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} className={inputCls} />
      </Field>
      <Field label="Source context" htmlFor="mf-sc" required error={errs.sourceContext} hint="Where in the source records this was observed. Monitors never overwrite source data.">
        <input id="mf-sc" value={f.sourceContext} onChange={(e) => set("sourceContext", e.target.value)} className={inputCls} />
      </Field>
      <button type="submit" disabled={busy} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-stone-50 disabled:opacity-60">
        {busy ? "Recording…" : "Record finding"}
      </button>
    </form>
  );
}

export function QueryForm({ sites, participants, defaultSiteId, defaultParticipantId }: {
  sites: { id: string; name: string }[]; participants: { id: string; code: string }[];
  defaultSiteId?: string; defaultParticipantId?: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [f, setF] = useState({
    siteId: defaultSiteId ?? sites[0]?.id ?? "", participantId: defaultParticipantId ?? "", category: "Data",
    question: "", dueAt: new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
  });
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <form className="space-y-3 p-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErrs({});
      const res = await callApi("/api/queries", "POST", { ...f, participantId: f.participantId || null });
      setBusy(false);
      if (res.ok) { push("success", (res.data as { message?: string }).message ?? "Query raised."); router.refresh(); }
      else if (res.status === 400 && res.data.errors) setErrs(res.data.errors as Record<string, string>);
      else push("error", res.data.error ?? "Save failed.");
    }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Site" htmlFor="qf-s" required>
          <select id="qf-s" value={f.siteId} onChange={(e) => set("siteId", e.target.value)} className={inputCls} disabled={!!defaultSiteId}>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Participant (optional)" htmlFor="qf-p">
          <select id="qf-p" value={f.participantId} onChange={(e) => set("participantId", e.target.value)} className={inputCls} disabled={!!defaultParticipantId}>
            <option value="">— general query —</option>
            {participants.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
          </select>
        </Field>
        <Field label="Category" htmlFor="qf-c" required>
          <select id="qf-c" value={f.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
            <option>Data</option><option>Lab</option><option>Consent</option><option>Dates</option><option>Product</option><option>Other</option>
          </select>
        </Field>
      </div>
      <Field label="Question to the site" htmlFor="qf-q" required error={errs.question}>
        <textarea id="qf-q" rows={2} value={f.question} onChange={(e) => set("question", e.target.value)} className={inputCls} />
      </Field>
      <Field label="Response due date" htmlFor="qf-d" required>
        <input id="qf-d" type="date" value={f.dueAt} onChange={(e) => set("dueAt", e.target.value)} className={`${inputCls} max-w-[200px]`} />
      </Field>
      <button type="submit" disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        {busy ? "Raising…" : "Raise query"}
      </button>
    </form>
  );
}

export function QueryRespond({ queryId }: { queryId: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [text, setText] = useState("");
  const [ctx, setCtx] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form className="mt-2 space-y-2 rounded-md border border-stone-200 bg-stone-50 p-3" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErr(null);
      const res = await callApi("/api/queries", "PATCH", { id: queryId, action: "respond", text, sourceContext: ctx });
      setBusy(false);
      if (res.ok) { push("success", "Response recorded — awaiting reviewer resolution."); router.refresh(); }
      else setErr(res.data.error ?? "Failed.");
    }}>
      <Field label="Response text" htmlFor={`qr-${queryId}`} required>
        <textarea id={`qr-${queryId}`} rows={2} value={text} onChange={(e) => setText(e.target.value)} className={inputCls} />
      </Field>
      <Field label="Source context (required)" htmlFor={`qs-${queryId}`} hint="e.g., Site file S-0007/baseline page 2">
        <input id={`qs-${queryId}`} value={ctx} onChange={(e) => setCtx(e.target.value)} className={inputCls} />
      </Field>
      {err ? <p className="text-xs font-medium text-danger" role="alert">{err}</p> : null}
      <button type="submit" disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        {busy ? "Sending…" : "Send response"}
      </button>
    </form>
  );
}
