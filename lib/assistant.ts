import { db } from "./store";
import type { CompletenessFinding } from "./types";

/**
 * RULES-BASED completeness & deviation checks.
 * This is deliberately NOT clinical AI: it only detects protocol-process gaps
 * (missing expected visits/forms, overdue queries, unreviewed out-of-range results).
 * Humans decide what to do.
 */
export function completenessFindings(includeDismissed = false): CompletenessFinding[] {
  const d = db();
  const now = Date.now();
  const out: CompletenessFinding[] = [];

  for (const v of d.visits) {
    if (v.trialId !== "trial-026") continue;
    const p = d.participants.find((x) => x.id === v.participantId)!;
    if (v.status === "SCHEDULED" && new Date(v.dueAt).getTime() < now) {
      out.push({
        key: `visit-missing:${v.id}`,
        severity: "WARNING",
        title: `Potential completeness issue detected — ${p.code}`,
        rule: `Visit ${v.type} is expected but no completed visit record exists.`,
        source: `Trial schedule → ${v.type} (due ${v.dueAt.slice(0, 10)})`,
        suggestion: `Coordinator should review Visit ${v.type} for ${p.code}.`,
        link: `/participants/${p.id}?tab=visits`,
      });
    }
  }

  const visitById = new Map(d.visits.map((v) => [v.id, v]));
  for (const o of d.observations) {
    const v = visitById.get(o.visitId);
    if (!v || v.trialId !== "trial-026") continue;
    if (o.fields.assessmentScore === null || o.fields.assessmentScore === undefined) {
      const p = d.participants.find((x) => x.id === o.participantId)!;
      out.push({
        key: `crf-incomplete:${o.id}`,
        severity: "WARNING",
        title: `Incomplete CRF — ${p.code}`,
        rule: `Required field "Protocol assessment score" is missing at ${v.type}.`,
        source: "Protocol-defined CRF → required field check",
        suggestion: `Coordinator should complete the CRF from source records for ${p.code}.`,
        link: `/participants/${p.id}?tab=crf`,
      });
    }
  }

  for (const p of d.participants) {
    if (p.trialId !== "trial-026" || p.status !== "SCREENED") continue;
    const c = d.consents.filter((x) => x.participantId === p.id).slice(-1)[0];
    if (c && c.status === "PENDING") {
      out.push({
        key: `consent-pending:${p.id}`,
        severity: "INFO",
        title: `Consent pending — ${p.code}`,
        rule: "Screening is complete but consent has not been accepted; enrollment gate remains blocked.",
        source: "Consent register",
        suggestion: `Coordinator should complete the consent discussion for ${p.code}.`,
        link: `/participants/${p.id}?tab=consent`,
      });
    }
  }

  for (const q of d.queries) {
    if (q.trialId !== "trial-026" || q.status === "RESOLVED") continue;
    if (new Date(q.dueAt).getTime() < now) {
      out.push({
        key: `query-overdue:${q.id}`,
        severity: "WARNING",
        title: `Query overdue — ${q.code}`,
        rule: "Query passed its due date without resolution.",
        source: `Monitoring register → ${q.code}`,
        suggestion: `Coordinator should respond; monitor/PI should resolve ${q.code}.`,
        link: "/monitoring?tab=queries",
      });
    }
  }

  for (const lab of d.labResults) {
    if (lab.flag !== "OUT_OF_RANGE") continue;
    const hasQuery = d.queries.some(
      (q) => q.participantId === lab.participantId && q.category === "Lab" && q.status !== "RESOLVED"
    );
    if (!hasQuery) {
      const p = d.participants.find((x) => x.id === lab.participantId)!;
      out.push({
        key: `lab-unreviewed:${lab.id}`,
        severity: "WARNING",
        title: `Out-of-range result without linked query — ${p.code}`,
        rule: "Out-of-range result. Human review required — the system does not interpret results.",
        source: `Lab register → ${lab.test} (${lab.value} ${lab.unit}, ref ${lab.refLow}–${lab.refHigh})`,
        suggestion: "Monitor may raise a query; site staff should record human review.",
        link: `/participants/${p.id}?tab=labs`,
      });
    }
  }

  const dismissed = new Set(d.assistant.dismissed);
  return includeDismissed ? out : out.filter((f) => !dismissed.has(f.key));
}

/** Aggregate-only draft summary. Inputs are counts/KPIs; no participant-level data. */
export function aggregateSummary(): { draft: string; inputs: Record<string, string> } {
  const d = db();
  const k = {
    enrolled: d.enrollments.filter((e) => e.trialId === "trial-026").length,
    target: 40,
    openQueries: d.queries.filter((q) => q.trialId === "trial-026" && q.status !== "RESOLVED").length,
    safety: d.pvTasks.filter((t) => t.status !== "DONE").length,
    resolvedQueries: d.queries.filter((q) => q.trialId === "trial-026" && q.status === "RESOLVED").length,
  };
  const vc = d.visits.filter((v) => v.trialId === "trial-026" && v.status === "COMPLETED").length;
  const inputs = {
    "Enrollment": `${k.enrolled} / ${k.target}`,
    "Open queries": String(k.openQueries),
    "Safety follow-up": String(k.safety),
    "Completed visits recorded": String(vc),
  };
  const draft =
    `Trial AIIA-AYU-026-DEMO currently has ${k.enrolled} enrolled participants against a target of ${k.target} ` +
    `(${Math.round((k.enrolled / k.target) * 100)}% of target). Monitoring has ${k.openQueries} open queries ` +
    `(${k.resolvedQueries} resolved to date). The pharmacovigilance queue holds ${k.safety} open follow-up/completeness ` +
    `task(s). ${vc} visit records are completed. Site-level enrollment and full tables are available in Reports & Exports. ` +
    `Recommended focus: clear overdue queries and complete expected visits flagged by the completeness assistant.`;
  return { draft, inputs };
}
