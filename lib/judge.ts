import { db } from "./store";

export interface JudgeStep {
  id: number;
  title: string;
  detail: string;
  href: string;
  roleHint: string;
}

export function judgeSteps(): JudgeStep[] {
  return [
    { id: 1, title: "Review dashboard", detail: "Trial readiness + live KPIs. Note: Enrolled 24/40, Open queries 5, Safety follow-up 3.", href: "/overview", roleHint: "any role" },
    { id: 2, title: "Open trial readiness", detail: "Protocol, ethics, CTRI and site checks — READY FOR ENROLLMENT.", href: "/trials/trial-026", roleHint: "any role" },
    { id: 3, title: "Open participant AYU-0025", detail: "Screening checklist complete; consent is the blocker.", href: "/participants/p-AYU-0025?tab=enrollment", roleHint: "Coordinator" },
    { id: 4, title: "Fix the blocker — accept consent", detail: "Screening tab → Consent section → Accept. Gate recomputes to READY.", href: "/participants/p-AYU-0025?tab=consent", roleHint: "Coordinator" },
    { id: 5, title: "Enroll the participant", detail: "Enrollment tab → Enroll Participant (24→25; duplicate codes are rejected).", href: "/participants/p-AYU-0025?tab=enrollment", roleHint: "Coordinator" },
    { id: 6, title: "Record visit + CRF + lab", detail: "Visits tab → Baseline: add CRF, add lab, complete visit.", href: "/participants/p-AYU-0025?tab=visits", roleHint: "Coordinator" },
    { id: 7, title: "Log an SAE", detail: "Safety → Report Event for any enrolled participant (mark SERIOUS).", href: "/safety", roleHint: "Coordinator / PI" },
    { id: 8, title: "PV follow-up", detail: "PV Officer: review the new case, add follow-up, check completeness.", href: "/safety", roleHint: "PV Officer" },
    { id: 9, title: "Raise a monitoring query", detail: "Monitor → create finding/query with due date.", href: "/monitoring", roleHint: "Monitor" },
    { id: 10, title: "Respond and resolve", detail: "Coordinator responds; Monitor/PI resolves. Open-queries KPI falls.", href: "/monitoring?tab=queries", roleHint: "Coordinator → Monitor" },
    { id: 11, title: "Show audit trail", detail: "Every action above is in the application-level audit history.", href: "/audit", roleHint: "any role" },
    { id: 12, title: "Export FHIR + CDISC-style CSV", detail: "Reports & Exports → download bundle and datasets.", href: "/reports", roleHint: "PI / Coordinator" },
  ];
}

function after(anchor: string | null, iso?: string | null): boolean {
  return !!anchor && !!iso && new Date(iso).getTime() >= new Date(anchor).getTime();
}

export function judgeProgress(): { steps: (JudgeStep & { done: boolean })[]; startedAt: string | null } {
  const d = db();
  const anchor = d.judge.startedAt;
  const visited = new Set(d.judge.visited);
  const p25 = d.consents.filter((c) => c.participantId === "p-AYU-0025").slice(-1)[0];
  const enrolled25 = d.enrollments.find((e) => e.participantId === "p-AYU-0025");
  const visitDone = d.visits.some(
    (v) => v.participantId === "p-AYU-0025" && v.status === "COMPLETED" && after(anchor, v.completedAt)
  );
  const newSae = d.safetyEvents.find((s) => s.seriousness === "SERIOUS" && after(anchor, s.createdAt));
  const pvActed = !!newSae && newSae.log.some((l) => after(anchor, l.at) && l.role !== "COORDINATOR");
  const newQuery = d.queries.find((q) => after(anchor, q.createdAt));
  const responded = d.queries.some((q) => q.response && after(anchor, q.response.at));
  const resolved = d.queries.some((q) => q.resolution && after(anchor, q.resolution.at));
  const exported = d.exportsLog.some((e) => after(anchor, e.at));

  const done: Record<number, boolean> = {
    1: true,
    2: visited.has("/trials/trial-026"),
    3: visited.has("/participants/p-AYU-0025"),
    4: p25?.status === "ACCEPTED",
    5: !!enrolled25,
    6: visitDone,
    7: !!newSae,
    8: pvActed,
    9: !!newQuery,
    10: responded && resolved,
    11: visited.has("/audit"),
    12: exported,
  };
  return { steps: judgeSteps().map((s) => ({ ...s, done: done[s.id] ?? false })), startedAt: anchor };
}
