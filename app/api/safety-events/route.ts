import { NextRequest } from "next/server";
import { assertSiteScope, requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit, notify } from "@/lib/audit";
import { errConflict, errNotFound, errValidation } from "@/lib/errors";
import { body, isDate, ok, route, str } from "@/lib/api";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const user = requirePerm("safety.create");
  const b = await body<Record<string, unknown>>(req);
  const d = db();
  const participantId = str(b.participantId, "participantId", { required: true });
  const p = d.participants.find((x) => x.id === participantId);
  if (!p || p.status !== "ENROLLED") throw errValidation("Safety events can only be recorded for enrolled participants.");
  assertSiteScope(user, p.siteId);

  const errors: Record<string, string> = {};
  const term = str(b.term, "term", { required: true });
  if (!term) errors.term = "Event term is required.";
  const narrative = str(b.narrative, "narrative", { required: true });
  if (!narrative) errors.narrative = "Narrative is required.";
  const onsetAt = isDate(b.onsetAt);
  if (!onsetAt) errors.onsetAt = "Onset date is required.";
  else if (new Date(onsetAt).getTime() > Date.now() + 60000) errors.onsetAt = "Onset date cannot be in the future.";
  const seriousness = str(b.seriousness, "seriousness", { required: true });
  if (!["SERIOUS", "NON_SERIOUS"].includes(seriousness)) errors.seriousness = "Seriousness must be SERIOUS or NON_SERIOUS (human assessment).";
  const severity = str(b.severity, "severity", { required: true });
  if (!["MILD", "MODERATE", "SEVERE"].includes(severity)) errors.severity = "Severity must be MILD, MODERATE or SEVERE.";
  const criteria = Array.isArray(b.seriousnessCriteria) ? (b.seriousnessCriteria as string[]) : [];
  if (seriousness === "SERIOUS" && criteria.length === 0) errors.seriousnessCriteria = "Select at least one seriousness criterion (human assessment).";
  const batch = str(b.batch, "batch", { required: true });
  if (!batch) errors.batch = "Batch is required.";
  if (Object.keys(errors).length) return Response.json({ error: "Validation failed — see field errors.", errors }, { status: 400 });

  const serious = seriousness === "SERIOUS";
  const count = d.safetyEvents.length + 1;
  const caseNo = `${serious ? "SAE" : "AE"}-DEMO-${String(count).padStart(3, "0")}`;
  const id = `se-${Date.now().toString(36)}`;
  const now = nowIso();

  d.safetyEvents.push({
    id, caseNo, participantId: p.id, trialId: p.trialId,
    term, narrative, onsetAt: onsetAt!, awarenessAt: isDate(b.awarenessAt) ?? onsetAt!,
    seriousness: serious ? "SERIOUS" : "NON_SERIOUS", seriousnessCriteria: criteria,
    severity: severity as never, suspectedProduct: str(b.suspectedProduct, "suspectedProduct", { required: true }),
    batch, outcome: str(b.outcome, "outcome") || "",
    status: serious ? "PI_REVIEW_PENDING" : "IDENTIFIED",
    piReviewedAt: null, createdBy: user.name, createdAt: now,
    log: [{ at: now, by: user.name, role: user.role, text: serious ? "Initial SAE record created; PV follow-up task auto-created." : "Initial AE record created." }],
  });

  const dueAt = new Date(new Date(now).getTime() + (serious ? 3 : 5) * 86400000).toISOString();
  d.pvTasks.push({
    id: `pt-${Date.now().toString(36)}`, caseId: id,
    type: serious ? "FOLLOW_UP" : "COMPLETENESS_REVIEW",
    dueAt, status: serious ? "FOLLOW_UP_DUE" : "PENDING",
    owner: "Dr. Meera Iyer (PV Officer)", createdAt: now,
  });

  logAudit({ actor: user.name, role: user.role, entity: "Safety event", entityId: id, action: "CREATED", to: serious ? "PI_REVIEW_PENDING" : "IDENTIFIED", reason: `${caseNo} for ${p.code}: ${term}${serious ? " — PV task auto-created, safety KPI updated" : ""}` });
  notify({
    title: `${caseNo} recorded — ${p.code}`,
    body: serious ? "SERIOUS event: PI review pending; PV follow-up task created automatically. Safety follow-up KPI updated." : "AE recorded: PV completeness review task created.",
    link: `/safety?case=${id}`, roles: ["PI", "PV_OFFICER", "COORDINATOR", "ADMIN"],
  });
  await persist();
  return ok({ message: `${caseNo} recorded for ${p.code}.${serious ? " PV follow-up task auto-created — safety KPI updated." : " PV completeness task created."}`, id, caseNo }, 201);
});

export const PATCH = route(async (req: NextRequest) => {
  const b = await body<Record<string, unknown>>(req);
  const action = str(b.action, "action", { required: true });
  const d = db();
  const ev = d.safetyEvents.find((s) => s.id === str(b.id, "id", { required: true }));
  if (!ev) throw errNotFound("Safety case not found.");
  const p = d.participants.find((x) => x.id === ev.participantId)!;
  const now = nowIso();

  const log = (text: string, by: string, role: typeof ev.log[number]["role"]) => ev.log.push({ at: now, by, role, text });

  if (action === "piReview") {
    const user = requirePerm("safety.piReview", "Only the PI can record the safety review.");
    if (ev.status !== "IDENTIFIED" && ev.status !== "PI_REVIEW_PENDING") throw errConflict("PI review already recorded.");
    ev.status = "PI_REVIEWED";
    ev.piReviewedAt = now;
    log("PI review completed.", user.name, "PI");
    logAudit({ actor: user.name, role: user.role, entity: "Safety event", entityId: ev.id, action: "PI_REVIEW", from: "PI_REVIEW_PENDING", to: "PI_REVIEWED", reason: `${ev.caseNo} (${p.code}) reviewed by PI — human determination` });
    await persist();
    return ok({ message: "PI review recorded." });
  }

  const user = requirePerm("pv.act", "PV queue actions are restricted to the PV Officer.");

  if (action === "review") {
    if (ev.status === "CLOSED") throw errConflict("Case is closed.");
    if (ev.status === "PV_IN_REVIEW" || ev.status === "FOLLOW_UP") throw errConflict("Case is already in PV review.");
    ev.status = "PV_IN_REVIEW";
    const task = d.pvTasks.find((t) => t.caseId === ev.id && t.status !== "DONE");
    if (task) task.status = "IN_REVIEW";
    log("PV review started (completeness check).", user.name, "PV_OFFICER");
    logAudit({ actor: user.name, role: user.role, entity: "Safety event", entityId: ev.id, action: "PV_REVIEW_STARTED", from: ev.status, to: "PV_IN_REVIEW", reason: `${ev.caseNo} (${p.code}) completeness review` });
    await persist();
    return ok({ message: "Case moved to IN REVIEW." });
  }

  if (action === "assignFollowUp") {
    if (ev.status === "CLOSED") throw errConflict("Case is closed — reopen is not permitted in this demo.");
    const days = Number(b.days) || 3;
    const dueAt = new Date(new Date(now).getTime() + days * 86400000).toISOString();
    let task = d.pvTasks.find((t) => t.caseId === ev.id && t.status !== "DONE");
    if (task) { task.status = "FOLLOW_UP_DUE"; task.dueAt = dueAt; task.type = "FOLLOW_UP"; }
    else d.pvTasks.push({ id: `pt-${Date.now().toString(36)}`, caseId: ev.id, type: "FOLLOW_UP", dueAt, status: "FOLLOW_UP_DUE", owner: user.name, createdAt: now });
    ev.status = "FOLLOW_UP";
    log(`Follow-up assigned (due ${dueAt.slice(0, 10)}).`, user.name, "PV_OFFICER");
    logAudit({ actor: user.name, role: user.role, entity: "PV task", entityId: ev.id, action: "FOLLOW_UP_ASSIGNED", to: "FOLLOW_UP_DUE", reason: `${ev.caseNo}: follow-up due in ${days} day(s) — safety KPI updated` });
    await persist();
    return ok({ message: `Follow-up assigned — task due ${dueAt.slice(0, 10)}. Safety KPI updated.` });
  }

  if (action === "addFollowUp") {
    if (ev.status === "CLOSED") throw errConflict("Case is closed.");
    const text = str(b.reason, "follow-up note", { required: true });
    ev.status = "FOLLOW_UP";
    let task = d.pvTasks.find((t) => t.caseId === ev.id && t.status !== "DONE");
    if (task && task.status === "PENDING") task.status = "FOLLOW_UP_DUE";
    log(`Follow-up: ${text}`, user.name, "PV_OFFICER");
    logAudit({ actor: user.name, role: user.role, entity: "Safety event", entityId: ev.id, action: "FOLLOW_UP_NOTE", to: "FOLLOW_UP", reason: text });
    await persist();
    return ok({ message: "Follow-up note added to the case file." });
  }

  if (action === "close") {
    const reason = str(b.reason, "closure rationale", { required: true });
    if (ev.status === "CLOSED") throw errConflict("Case is already closed.");
    // completeness gate — the system enforces case completeness before closure
    const gaps: string[] = [];
    if (!ev.outcome) gaps.push("outcome not recorded");
    if (!ev.piReviewedAt) gaps.push("PI review pending");
    if (ev.seriousness === "SERIOUS" && ev.seriousnessCriteria.length === 0) gaps.push("seriousness criteria missing");
    if (!ev.batch) gaps.push("batch missing");
    if (!ev.narrative) gaps.push("narrative missing");
    if (gaps.length) throw errValidation(`Case completeness gaps: ${gaps.join("; ")}. Complete the case before closing.`);
    ev.status = "CLOSED";
    const task = d.pvTasks.find((t) => t.caseId === ev.id && t.status !== "DONE");
    if (task) task.status = "DONE";
    log(`Case closed. Rationale: ${reason}`, user.name, "PV_OFFICER");
    logAudit({ actor: user.name, role: user.role, entity: "Safety event", entityId: ev.id, action: "CLOSED", from: ev.status, to: "CLOSED", reason: `${ev.caseNo} (${p.code}) closed after completeness verification` });
    notify({ title: `${ev.caseNo} closed`, body: `Case closed after completeness verification. Safety follow-up KPI updated.`, link: `/safety?tab=CLOSED&case=${ev.id}`, roles: ["PI", "PV_OFFICER", "ADMIN"] });
    await persist();
    return ok({ message: "Case closed — completeness verified. Safety KPI updated." });
  }

  throw errValidation(`Unknown safety action "${action}".`);
});
