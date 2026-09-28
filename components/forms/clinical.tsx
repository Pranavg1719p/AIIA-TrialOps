"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client";
import { useToast } from "../toast";
import { Field, inputCls } from "../ui";

function todayLocal(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/* ---------------- create visit ---------------- */
export function VisitCreate({ participantId, participants }: { participantId?: string; participants?: { id: string; code: string }[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [type, setType] = useState("BASELINE");
  const [dueAt, setDueAt] = useState(todayLocal());
  const [pid, setPid] = useState(participants?.[0]?.id ?? participantId ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <form className="space-y-3 p-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErr(null);
      const res = await callApi("/api/visits", "POST", { participantId: participantId ?? pid, type, dueAt });
      setBusy(false);
      if (res.ok) { push("success", `${type} visit scheduled.`); router.refresh(); }
      else setErr(res.data.error ?? "Failed.");
    }}>
      <div className="grid gap-3 sm:grid-cols-3">
        {participants ? (
          <Field label="Participant" htmlFor="vcp" required>
            <select id="vcp" value={pid} onChange={(e) => setPid(e.target.value)} className={inputCls}>
              {participants.map((p) => <option key={p.id} value={p.id}>{p.code}</option>)}
            </select>
          </Field>
        ) : null}
        <Field label="Visit" htmlFor="vct" required>
          <select id="vct" value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
            {["BASELINE", "V1", "V2", "V3", "FOLLOW_UP"].map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
          </select>
        </Field>
        <Field label="Due date" htmlFor="vcd" required hint="Protocol visit window (demo)">
          <input id="vcd" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={inputCls} required />
        </Field>
      </div>
      {err ? <p className="text-xs font-medium text-danger" role="alert">{err}</p> : null}
      <button type="submit" disabled={busy} className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-stone-50 disabled:opacity-60">
        {busy ? "Scheduling…" : "Schedule visit"}
      </button>
    </form>
  );
}

/* ---------------- CRF ---------------- */
const CRF_DEFAULTS = {
  formulation: "AYU-Form-A (demo)", batch: "BATCH-2026-014", dose: "500", doseUnit: "mg", route: "Oral",
  anupana: "Warm water", dietAdherence: "Protocol diet followed", lifestyleCompliance: true,
  assessmentScore: "", notes: "", visitDate: "",
};

export function CrfForm({ visitId, participantId }: { visitId: string; participantId: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [f, setF] = useState({ ...CRF_DEFAULTS, visitDate: todayLocal() });
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  return (
    <form className="space-y-3 p-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErrs({});
      const res = await callApi("/api/observations", "POST", { visitId, participantId, fields: f });
      setBusy(false);
      if (res.ok) { push("success", "CRF saved with server-side validation."); router.refresh(); }
      else if (res.status === 400 && res.data.errors) setErrs(res.data.errors as Record<string, string>);
      else push("error", res.data.error ?? "Save failed.");
    }}>
      <p className="text-[11px] text-ink-mute">Protocol-defined values only. The system does not infer Prakriti, Dosha, Agni or any clinical concept.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Formulation / product" htmlFor="crf-f" required error={errs.formulation}>
          <select id="crf-f" value={f.formulation} onChange={(e) => set("formulation", e.target.value)} className={inputCls}>
            <option>AYU-Form-A (demo)</option>
          </select>
        </Field>
        <Field label="Batch" htmlFor="crf-b" required error={errs.batch}>
          <input id="crf-b" value={f.batch} onChange={(e) => set("batch", e.target.value)} className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dose / matra" htmlFor="crf-d" required error={errs.dose}>
            <input id="crf-d" type="number" min="1" value={f.dose} onChange={(e) => set("dose", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Unit" htmlFor="crf-du">
            <select id="crf-du" value={f.doseUnit} onChange={(e) => set("doseUnit", e.target.value)} className={inputCls}>
              <option>mg</option><option>mL</option>
            </select>
          </Field>
        </div>
        <Field label="Route" htmlFor="crf-r" required>
          <select id="crf-r" value={f.route} onChange={(e) => set("route", e.target.value)} className={inputCls}>
            <option>Oral</option><option>Local (external)</option>
          </select>
        </Field>
        <Field label="Anupana" htmlFor="crf-a" required error={errs.anupana}>
          <select id="crf-a" value={f.anupana} onChange={(e) => set("anupana", e.target.value)} className={inputCls}>
            <option>Warm water</option><option>Honey (demo)</option><option>Milk (demo)</option>
          </select>
        </Field>
        <Field label="Visit date" htmlFor="crf-vd" required hint="Cannot be a future date" error={errs.visitDate}>
          <input id="crf-vd" type="date" max={todayLocal()} value={f.visitDate} onChange={(e) => set("visitDate", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Diet / lifestyle (protocol field)" htmlFor="crf-diet" required error={errs.dietAdherence}>
          <select id="crf-diet" value={f.dietAdherence} onChange={(e) => set("dietAdherence", e.target.value)} className={inputCls}>
            <option>Protocol diet followed</option><option>Partial deviation</option><option>Not recorded</option>
          </select>
        </Field>
        <Field label="Assessment score (outcome instrument 0–10)" htmlFor="crf-s" required hint="Range 0–10, integer" error={errs.assessmentScore}>
          <input id="crf-s" type="number" min="0" max="10" step="1" value={f.assessmentScore} onChange={(e) => set("assessmentScore", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Notes (optional)" htmlFor="crf-n">
          <input id="crf-n" value={f.notes} onChange={(e) => set("notes", e.target.value)} className={inputCls} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-xs text-ink-soft">
        <input type="checkbox" checked={f.lifestyleCompliance} onChange={(e) => set("lifestyleCompliance", e.target.checked)} className="h-4 w-4 accent-[#8f1d22]" />
        Lifestyle compliance confirmed per protocol checklist
      </label>
      <button type="submit" disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        {busy ? "Validating…" : "Save CRF"}
      </button>
    </form>
  );
}

/* ---------------- lab result ---------------- */
const LAB_TESTS = [
  { name: "Haemoglobin (Hb)", unit: "g/dL", low: "12", high: "15" },
  { name: "Erythrocyte Sedimentation Rate (ESR)", unit: "mm/hr", low: "0", high: "20" },
  { name: "Fasting Blood Sugar (demo)", unit: "mg/dL", low: "70", high: "110" },
];

export function LabForm({ participantId, visitId }: { participantId: string; visitId?: string | null }) {
  const router = useRouter();
  const { push } = useToast();
  const [test, setTest] = useState(LAB_TESTS[0].name);
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState(LAB_TESTS[0].unit);
  const [low, setLow] = useState(LAB_TESTS[0].low);
  const [high, setHigh] = useState(LAB_TESTS[0].high);
  const [collectedAt, setCollectedAt] = useState(todayLocal());
  const [status, setStatus] = useState("FINAL");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onTest = (name: string) => {
    const t = LAB_TESTS.find((x) => x.name === name)!;
    setTest(t.name); setUnit(t.unit); setLow(t.low); setHigh(t.high);
  };

  return (
    <form className="space-y-3 p-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true); setErr(null);
      const res = await callApi("/api/labs", "POST", { participantId, visitId: visitId ?? null, test, value, unit, refLow: low, refHigh: high, collectedAt, status });
      setBusy(false);
      if (res.ok) {
        const flagged = (res.data as { outOfRange?: boolean }).outOfRange;
        push(flagged ? "info" : "success", flagged ? "Lab saved — out-of-range result. Human review required." : "Lab result saved.");
        router.refresh();
      } else setErr(res.data.error ?? "Save failed.");
    }}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Test" htmlFor="lab-t" required>
          <select id="lab-t" value={test} onChange={(e) => onTest(e.target.value)} className={inputCls}>
            {LAB_TESTS.map((t) => <option key={t.name}>{t.name}</option>)}
          </select>
        </Field>
        <Field label="Value" htmlFor="lab-v" required>
          <input id="lab-v" type="number" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} className={inputCls} required />
        </Field>
        <Field label="Unit" htmlFor="lab-u" required>
          <input id="lab-u" value={unit} onChange={(e) => setUnit(e.target.value)} className={inputCls} required />
        </Field>
        <Field label="Reference low" htmlFor="lab-lo" required>
          <input id="lab-lo" type="number" step="0.1" value={low} onChange={(e) => setLow(e.target.value)} className={inputCls} required />
        </Field>
        <Field label="Reference high" htmlFor="lab-hi" required>
          <input id="lab-hi" type="number" step="0.1" value={high} onChange={(e) => setHigh(e.target.value)} className={inputCls} required />
        </Field>
        <Field label="Collection date" htmlFor="lab-d" required hint="Cannot be a future date">
          <input id="lab-d" type="date" max={todayLocal()} value={collectedAt} onChange={(e) => setCollectedAt(e.target.value)} className={inputCls} required />
        </Field>
        <Field label="Result status" htmlFor="lab-s">
          <select id="lab-s" value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            <option>FINAL</option><option>PENDING</option>
          </select>
        </Field>
      </div>
      {err ? <p className="text-xs font-medium text-danger" role="alert">{err}</p> : null}
      <p className="text-[11px] text-ink-mute">Out-of-range values are flagged for <strong>human review</strong> — the system never diagnoses or recommends treatment.</p>
      <button type="submit" disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        {busy ? "Saving…" : "Save lab result"}
      </button>
    </form>
  );
}
