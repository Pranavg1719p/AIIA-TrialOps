import { NextRequest } from "next/server";
import { assertSiteScope, requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit, notify } from "@/lib/audit";
import { errConflict, errNotFound } from "@/lib/errors";
import { body, ok, route, str } from "@/lib/api";
import { enrollmentGate } from "@/lib/kpi";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = route(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  requirePerm("participant.read");
  const gate = enrollmentGate(params.id);
  return ok({ gate });
});

export const POST = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const user = requirePerm("enroll");
  const b = await body<{ checkOnly?: boolean; subjectCode?: string; siteId?: string }>(req);
  const d = db();
  const p = d.participants.find((x) => x.id === params.id);
  if (!p) throw errNotFound("Participant not found.");
  assertSiteScope(user, p.siteId);

  // duplicate subject-code guard (server-side unique check on trial + subject_code)
  if (b.checkOnly) {
    const code = str(b.subjectCode, "subject code", { required: true }).toUpperCase();
    const clash = d.participants.some((x) => x.trialId === p.trialId && x.code === code && x.id !== p.id);
    if (clash) throw errConflict(`Enrollment blocked: subject code already exists (${code} is enrolled/registered in this trial).`);
    const selfEnrolled = d.enrollments.some((e) => e.participantId === p.id);
    if (selfEnrolled || code === p.code) {
      if (selfEnrolled) throw errConflict(`Enrollment blocked: subject code already exists (${p.code} is already enrolled).`);
    }
    return ok({ message: `Subject code ${code} is available — no duplicate found in this trial.` });
  }

  const already = d.enrollments.find((e) => e.participantId === p.id);
  if (already) throw errConflict(`Enrollment blocked: subject code already exists (${p.code} is already enrolled).`);
  const codeClash = d.participants.some((x) => x.trialId === p.trialId && x.code === p.code && x.id !== p.id);
  if (codeClash) throw errConflict(`Enrollment blocked: subject code already exists.`);

  const gate = enrollmentGate(p.id);
  if (gate.state !== "READY") {
    throw errConflict("Enrollment blocked: " + gate.blockers.join(" "));
  }

  const prevStatus = p.status;
  const enrolledAt = nowIso();
  d.enrollments.push({ participantId: p.id, trialId: p.trialId, siteId: p.siteId, enrolledAt, enrolledBy: user.name });
  p.status = "ENROLLED";

  // auto-create the protocol visit schedule (each visit is individually auditable)
  const day = 86400000;
  const schedule: [string, number][] = [["BASELINE", 0], ["V1", 14], ["V2", 45], ["V3", 90], ["FOLLOW_UP", 180]];
  let n = 0;
  for (const [type, offset] of schedule) {
    n += 1;
    const vid = `v-${p.code}-${type}-${Date.now().toString(36)}${n}`;
    d.visits.push({
      id: vid,
      participantId: p.id, trialId: p.trialId, type: type as never,
      dueAt: new Date(new Date(enrolledAt).getTime() + offset * day).toISOString(),
      status: "SCHEDULED", completedAt: null, completedBy: null,
    });
    logAudit({ actor: user.name, role: user.role, entity: "Visit", entityId: vid, action: "SCHEDULED", to: "SCHEDULED", reason: `Auto-created from enrollment of ${p.code} (protocol schedule)` });
  }

  logAudit({ actor: user.name, role: user.role, entity: "Enrollment", entityId: p.id, action: "ENROLLED", from: prevStatus, to: "ENROLLED", reason: "Gate passed: screening complete, PI reviewed, consent accepted, site active, CTRI registered (demo)" });
  notify({ title: `${p.code} enrolled`, body: `Enrollment count updated. Baseline visit scheduled; visit completion KPI recalculated.`, link: `/participants/${p.id}?tab=visits`, roles: ["PI", "COORDINATOR", "MONITOR", "LEADERSHIP", "ADMIN"] });
  await persist();
  return ok({ message: `${p.code} enrolled — KPIs, queues and audit updated.`, enrolledAt, visitSchedule: schedule.map(([t]) => t) });
});
