import { db } from "./store";
import { DEMO_TRIAL_ID } from "./seed";
import type { CompletenessFinding, Participant, Trial } from "./types";

export function activeTrial(): Trial {
  return db().trials.find((t) => t.id === DEMO_TRIAL_ID)!;
}

export function participantByCode(code: string) {
  return db().participants.find((p) => p.code === code && p.trialId === DEMO_TRIAL_ID);
}

export function siteName(id: string): string {
  return db().sites.find((s) => s.id === id)?.name ?? id;
}

export function participantName(p: Participant): string {
  return p.code; // synthetic coded identity — no names/PHI by design
}

export function enrolledParticipants(trialId: string) {
  const ids = new Set(db().enrollments.filter((e) => e.trialId === trialId).map((e) => e.participantId));
  return db().participants.filter((p) => ids.has(p.id));
}

export interface Kpis {
  activeTrials: number;
  enrolled: number;
  target: number;
  openQueries: number;
  safetyFollowUp: number;
  ethicsAlerts: number;
  missingData: number;
}

export function ethicsCtriAlerts(trialId: string) {
  const d = db();
  const now = Date.now();
  const ethics = d.ethicsSubmissions.filter(
    (e) => e.trialId === trialId &&
      (e.status === "EXPIRED" || (e.expiresAt && new Date(e.expiresAt).getTime() - now < 30 * 86400000 && new Date(e.expiresAt).getTime() > now))
  );
  const trial = d.trials.find((t) => t.id === trialId)!;
  const ctriAlerts: string[] = [];
  if (trial.ctri.state !== "REGISTERED") ctriAlerts.push(`CTRI is in ${trial.ctri.state} state — final registration pending.`);
  if (trial.ctri.renewalDueAt && new Date(trial.ctri.renewalDueAt).getTime() - now < 30 * 86400000)
    ctriAlerts.push(`CTRI renewal due ${trial.ctri.renewalDueAt.slice(0, 10)}.`);
  return { ethics, ctriAlerts, total: ethics.length + ctriAlerts.length };
}

export function missingDataItems(trialId: string) {
  const d = db();
  const now = Date.now();
  const overdueVisits = d.visits.filter(
    (v) => v.trialId === trialId && v.status === "SCHEDULED" && new Date(v.dueAt).getTime() < now
  );
  const visitById = new Map(d.visits.map((v) => [v.id, v]));
  const incompleteCrfs = d.observations.filter(
    (o) => visitById.get(o.visitId)?.trialId === trialId && (o.fields.assessmentScore === null || o.fields.assessmentScore === undefined)
  );
  return { overdueVisits, incompleteCrfs, total: overdueVisits.length + incompleteCrfs.length };
}

export function computeKpis(trialId: string): Kpis {
  const d = db();
  const enrolled = d.enrollments.filter((e) => e.trialId === trialId).length;
  const trial = d.trials.find((t) => t.id === trialId)!;
  return {
    activeTrials: d.trials.filter((t) => t.status === "ACTIVE").length,
    enrolled,
    target: trial.targetEnrollment,
    openQueries: d.queries.filter((q) => q.trialId === trialId && q.status !== "RESOLVED").length,
    safetyFollowUp: d.pvTasks.filter((t) => t.status !== "DONE").length,
    ethicsAlerts: ethicsCtriAlerts(trialId).total,
    missingData: missingDataItems(trialId).total,
  };
}

export function visitCompletion(trialId: string) {
  const d = db();
  const now = Date.now();
  const expected = d.visits.filter(
    (v) => v.trialId === trialId && v.status === "COMPLETED" && new Date(v.completedAt ?? v.dueAt).getTime() <= now
  ).length;
  const overdue = d.visits.filter(
    (v) => v.trialId === trialId && v.status === "SCHEDULED" && new Date(v.dueAt).getTime() < now
  ).length;
  const completed = expected;
  const dueTotal = expected + overdue;
  return { completed, dueTotal, pct: dueTotal ? Math.round((completed / dueTotal) * 100) : 100, overdue };
}

export function enrollmentBySite(trialId: string) {
  const d = db();
  const trial = d.trials.find((t) => t.id === trialId)!;
  return trial.siteIds.map((sid) => {
    const site = d.sites.find((s) => s.id === sid)!;
    return { site, count: d.enrollments.filter((e) => e.trialId === trialId && e.siteId === sid).length };
  });
}

export function queryStatusCounts(trialId: string) {
  const d = db();
  const qs = d.queries.filter((q) => q.trialId === trialId);
  return {
    open: qs.filter((q) => q.status === "OPEN").length,
    responded: qs.filter((q) => q.status === "RESPONDED").length,
    resolved: qs.filter((q) => q.status === "RESOLVED").length,
  };
}

export function safetyTaskCounts() {
  const d = db();
  return {
    pending: d.pvTasks.filter((t) => t.status === "PENDING").length,
    followUp: d.pvTasks.filter((t) => t.status === "FOLLOW_UP_DUE").length,
    inReview: d.pvTasks.filter((t) => t.status === "IN_REVIEW").length,
    done: d.pvTasks.filter((t) => t.status === "DONE").length,
  };
}

export interface GateResult {
  state: "READY" | "BLOCKED" | "ENROLLED";
  blockers: string[];
  checks: { label: string; ok: boolean; detail?: string }[];
}

export function enrollmentGate(participantId: string): GateResult {
  const d = db();
  const p = d.participants.find((x) => x.id === participantId);
  if (!p) return { state: "BLOCKED", blockers: ["Participant not found."], checks: [] };
  const enrolled = d.enrollments.find((e) => e.participantId === p.id);
  const site = d.sites.find((s) => s.id === p.siteId)!;
  const trial = d.trials.find((t) => t.id === p.trialId)!;
  const scr = d.screenings.find((s) => s.participantId === p.id);
  const consent = d.consents.filter((c) => c.participantId === p.id).slice(-1)[0];

  const manualOk = !!scr && scr.items.every((i) => i.done);
  const piOk = !!scr?.piReviewedAt;
  const consentOk = consent?.status === "ACCEPTED";
  const siteOk = site.status === "ACTIVE";
  const ctriOk = trial.ctri.state === "REGISTERED";

  const checks = [
    { label: "Screening checklist complete", ok: manualOk },
    { label: "PI / delegate review", ok: piOk },
    { label: "Consent accepted", ok: consentOk, detail: consent ? `Status: ${consent.status}` : "No consent record" },
    { label: "Site active", ok: siteOk, detail: site.name },
    { label: "CTRI registered (demo)", ok: ctriOk, detail: `State: ${trial.ctri.state}` },
    { label: "Not already enrolled", ok: !enrolled },
  ];

  const blockers: string[] = [];
  if (enrolled) return { state: "ENROLLED", blockers: ["Participant is already enrolled."], checks };
  if (!manualOk)
    blockers.push("Eligibility review incomplete: " + (scr?.items.filter((i) => !i.done).map((i) => i.label.toLowerCase()).join("; ") ?? "checklist missing") + ".");
  if (!piOk) blockers.push("PI / delegate eligibility review is pending.");
  if (!consentOk) blockers.push("Consent has not been accepted.");
  if (!siteOk) blockers.push("Site is inactive.");
  if (!ctriOk) blockers.push("CTRI is not in final registered state (demo).");
  return { state: blockers.length ? "BLOCKED" : "READY", blockers, checks };
}

export function trialReadiness(trialId: string) {
  const d = db();
  const trial = d.trials.find((t) => t.id === trialId)!;
  const now = Date.now();
  const validApprovals = d.ethicsSubmissions.filter(
    (e) => e.trialId === trialId && e.status === "APPROVED" && e.expiresAt && new Date(e.expiresAt).getTime() > now
  );
  const expired = d.ethicsSubmissions.filter((e) => e.trialId === trialId && e.status === "EXPIRED");
  const siteActive = trial.siteIds.every((sid) => d.sites.find((s) => s.id === sid)?.status === "ACTIVE");
  const rows = [
    { label: "Protocol available", ok: !!trial.protocolVersion, detail: `Protocol ${trial.protocolVersion}` },
    { label: "Ethics approved", ok: validApprovals.length > 0, detail: expired.length ? `${expired.length} site approval(s) expired — affected site enrollment paused` : `${validApprovals.length} valid site approval(s)` },
    { label: "CTRI registered", ok: trial.ctri.state === "REGISTERED", detail: trial.ctri.state === "REGISTERED" ? `${trial.ctri.ref} (demo)` : `State: ${trial.ctri.state}` },
    { label: "Site active", ok: siteActive, detail: `${trial.siteIds.length} sites` },
    { label: "Current consent version", ok: !!trial.consentVersion, detail: trial.consentVersion },
    { label: "Eligibility rules configured", ok: true, detail: "Protocol-defined inclusion/exclusion checklist" },
  ];
  const warnings: string[] = [];
  if (expired.length) warnings.push(`${expired.length} site ethics approval expired — enrollment paused at affected site only.`);
  if (trial.ctri.renewalDueAt && new Date(trial.ctri.renewalDueAt).getTime() - now < 30 * 86400000)
    warnings.push("CTRI renewal window approaching (demo registration).");
  return {
    rows,
    warnings,
    state: rows.every((r) => r.ok) ? ("READY_FOR_ENROLLMENT" as const) : ("BLOCKED" as const),
  };
}

export interface TrialTask {
  label: string;
  count: number;
  href: string;
  tone: "danger" | "warn" | "info";
}

export function trialTasks(trialId: string): TrialTask[] {
  const d = db();
  const now = Date.now();
  const saeReview = d.safetyEvents.filter((s) => s.status === "PI_REVIEW_PENDING").length;
  const alerts = ethicsCtriAlerts(trialId).total;
  const missingCrf = missingDataItems(trialId).incompleteCrfs.length;
  const overdueQueries = d.queries.filter(
    (q) => q.trialId === trialId && q.status !== "RESOLVED" && new Date(q.dueAt).getTime() < now
  ).length;
  const tasks: TrialTask[] = [
    { label: "SAE review", count: saeReview, href: "/safety?filter=PI_REVIEW_PENDING", tone: "danger" },
    { label: "Ethics / CTRI expiry", count: alerts, href: "/ethics", tone: "warn" },
    { label: "Missing CRF", count: missingCrf, href: "/ai-assist", tone: "warn" },
    { label: "Query overdue", count: overdueQueries, href: "/monitoring?tab=queries&filter=OVERDUE", tone: "danger" },
  ];
  return tasks;
}
