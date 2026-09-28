"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client";
import { useToast } from "../toast";
import { ActionButton } from "../action";
import { inputCls } from "../ui";

/* ---------------- ethics + CTRI ---------------- */
export function EthicsActions({ id, status }: { id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "UNDER_REVIEW" || status === "SUBMITTED" ? (
        <ActionButton url="/api/ethics" body={{ id, action: "approve" }} label="Approve" small
          reason="Approval rationale (recorded for the ethics file)" success="Approval recorded." />
      ) : null}
      {status === "APPROVED" || status === "EXPIRED" ? (
        <ActionButton url="/api/ethics" body={{ id, action: "renew" }} label="Record renewal (+1 yr)" small
          reason="Renewal rationale — extends validity by one year" success="Renewal recorded — expiry extended." />
      ) : null}
    </div>
  );
}

export function CtriActions({ trialId, state }: { trialId: string; state: string }) {
  const { push } = useToast();
  const [ref, setRef] = useState("CTRI/REF/2026/0NEW");
  const [busy, setBusy] = useState(false);

  if (state === "DRAFT") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input value={ref} onChange={(e) => setRef(e.target.value)} aria-label="CTRI REF number" className={`${inputCls} max-w-[220px] font-mono text-xs`} />
        <ActionButton url="/api/ethics" body={{ type: "ctri", trialId, action: "assignRef", ref }} label="Assign CTRI REF" small
          reason="Rationale for issuing the REF number (REF is not final registration)" success="REF assigned — state is now REF (not registered)." />
      </div>
    );
  }
  if (state === "REF") {
    return (
      <ActionButton url="/api/ethics" body={{ type: "ctri", trialId, action: "register" }} label="Mark registered (demo)" small variant="primary"
        confirm="Record demo CTRI registration? REF alone is never treated as registration."
        reason="Rationale for recording registration (demo only — no external submission occurs)" success="CTRI marked REGISTERED (demo)." />
    );
  }
  return (
    <ActionButton url="/api/ethics" body={{ type: "ctri", trialId, action: "renew" }} label="Record renewal (+1 yr)" small
      reason="Renewal rationale — extends the renewal-due date by one year" success="CTRI renewal recorded." />
  );
}

/* ---------------- AI assistant actions ---------------- */
export function AssistantActions({ findingKey, suggestion }: { findingKey: string; suggestion: string }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <ActionButton url="/api/assistant/completeness" body={{ action: "accept", key: findingKey, actionText: suggestion }}
        label="Accept" small success="Accepted — corrective task logged to the coordinator queue." />
      <ActionButton url="/api/assistant/completeness" body={{ action: "dismiss", key: findingKey }}
        label="Dismiss" small variant="ghost" reason="Reason for dismissing this finding" success="Finding dismissed (kept in history)." />
    </div>
  );
}

export function SummaryGenerator() {
  const { push } = useToast();
  const [draft, setDraft] = useState<string | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await callApi("/api/assistant/summary", "POST");
            setBusy(false);
            if (res.ok) {
              setDraft(res.data.draft as string);
              setInputs((res.data.inputs as Record<string, string>) ?? {});
              push("success", "Draft generated from aggregate KPIs only.");
            } else push("error", res.data.error ?? "Generation failed.");
          }}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          {busy ? "Generating…" : "Generate draft summary"}
        </button>
        {draft ? (
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(draft); push("success", "Draft copied to clipboard."); }}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-stone-50">
            Copy
          </button>
        ) : null}
      </div>
      {draft ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(inputs).map(([k, v]) => (
              <span key={k} className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[11px] text-ink-soft">{k}: <strong>{v}</strong></span>
            ))}
          </div>
          <label htmlFor="summary-draft" className="block text-xs font-semibold text-ink-soft">Draft (editable)</label>
          <textarea id="summary-draft" rows={5} value={draft} onChange={(e) => setDraft(e.target.value)} className={inputCls} />
          <p className="rounded-md border border-warn-line bg-warn-bg px-2.5 py-1.5 text-[11px] font-semibold text-warn">
            ▲ AI-generated draft — PI review required. Built from aggregate counts only; no participant IDs, lab values, AE narratives or personal data are used.
          </p>
        </>
      ) : (
        <p className="text-xs text-ink-mute">Generates a narrative from aggregate counts and milestones only. In production this would call an approved model with a no-PHI contract.</p>
      )}
    </div>
  );
}

/* ---------------- admin: reset + judge scenario ---------------- */
export function AdminActions() {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (kind: "reset" | "judge") => {
    setBusy(kind);
    const res = await callApi(kind === "reset" ? "/api/admin/reset" : "/api/admin/judge-scenario", "POST");
    setBusy(null);
    if (res.ok) {
      push("success", kind === "reset" ? "Demo data reset to the original seeded state." : "Judge scenario loaded: blocked participant, ready participant, open SAE, open query, ethics warning.");
      router.refresh();
    } else push("error", res.data.error ?? "Failed.");
  };

  return (
    <div className="flex flex-wrap gap-2 p-4">
      <button type="button" onClick={() => { if (window.confirm("Reset ALL demo data to the original seeded state?")) void run("reset"); }}
        disabled={!!busy} className="rounded-md border border-danger-line bg-white px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-bg disabled:opacity-60">
        {busy === "reset" ? "Resetting…" : "Reset Demo Data"}
      </button>
      <button type="button" onClick={() => { if (window.confirm("Load the controlled judge scenario? (Resets data first.)")) void run("judge"); }}
        disabled={!!busy} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white hover:bg-black disabled:opacity-60">
        {busy === "judge" ? "Loading…" : "Load Judge Scenario"}
      </button>
    </div>
  );
}

/* ---------------- exports (download with audit) ---------------- */
export function ExportButton({ url, filename, label, sub }: { url: string; filename: string; label: string; sub?: string }) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-stone-200 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {sub ? <p className="truncate text-[11px] text-ink-mute">{sub}</p> : null}
      </div>
      <button type="button" disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch(url);
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              push("error", (j as { error?: string }).error ?? "Export failed.");
              return;
            }
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
            push("success", `${filename} downloaded (export recorded in audit).`);
          } finally {
            setBusy(false);
          }
        }}
        className="shrink-0 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
        {busy ? "…" : "Download"}
      </button>
    </div>
  );
}
