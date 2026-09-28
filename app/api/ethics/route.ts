import { NextRequest } from "next/server";
import { requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit, notify } from "@/lib/audit";
import { errConflict, errValidation } from "@/lib/errors";
import { body, ok, route, str } from "@/lib/api";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

function addYears(iso: string, years: number): string {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
}

export const PATCH = route(async (req: NextRequest) => {
  const b = await body<Record<string, unknown>>(req);
  const type = str(b.type, "type") || "submission";
  const d = db();

  if (type === "ctri") {
    const user = requirePerm("ctri.act", "CTRI state transitions are restricted to PI / Admin (demo).");
    const trial = d.trials.find((t) => t.id === str(b.trialId, "trialId", { required: true }));
    if (!trial) throw errValidation("Trial not found.");
    const action = str(b.action, "action", { required: true });
    if (action === "assignRef") {
      if (trial.ctri.state !== "DRAFT") throw errConflict("REF can only be assigned to a DRAFT CTRI record.");
      const ref = str(b.ref, "REF number", { required: true });
      const reason = str(b.reason, "rationale", { required: true });
      trial.ctri.state = "REF";
      trial.ctri.ref = ref;
      logAudit({ actor: user.name, role: user.role, entity: "CTRI record", entityId: trial.id, action: "REF_ASSIGNED", from: "DRAFT", to: "REF", reason: `${ref} issued (REF ≠ final registration). ${reason}` });
      await persist();
      return ok({ message: "REF assigned — note: REF is not final registration." });
    }
    if (action === "register") {
      if (trial.ctri.state !== "REF") throw errConflict("Only a REF-state record can be marked registered.");
      const reason = str(b.reason, "rationale", { required: true });
      trial.ctri.state = "REGISTERED";
      trial.ctri.registeredAt = nowIso();
      trial.ctri.renewalDueAt = addYears(nowIso(), 1);
      logAudit({ actor: user.name, role: user.role, entity: "CTRI record", entityId: trial.id, action: "REGISTERED", from: "REF", to: "REGISTERED", reason: `Demo registration recorded (no external submission). ${reason}` });
      await persist();
      return ok({ message: "CTRI marked REGISTERED (demo) — trial readiness recomputed." });
    }
    if (action === "renew") {
      if (trial.ctri.state !== "REGISTERED") throw errConflict("Only a registered record can be renewed.");
      const reason = str(b.reason, "rationale", { required: true });
      const base = trial.ctri.renewalDueAt && new Date(trial.ctri.renewalDueAt).getTime() > Date.now() ? trial.ctri.renewalDueAt : nowIso();
      trial.ctri.renewalDueAt = addYears(base, 1);
      logAudit({ actor: user.name, role: user.role, entity: "CTRI record", entityId: trial.id, action: "RENEWED", to: "REGISTERED", reason: `Renewal due extended to ${trial.ctri.renewalDueAt.slice(0, 10)}. ${reason}` });
      await persist();
      return ok({ message: "CTRI renewal recorded — alert cleared." });
    }
    throw errValidation(`Unknown CTRI action "${action}".`);
  }

  // ethics submission actions
  const user = requirePerm("ethics.act", "Ethics decisions are restricted to the Ethics Member role.");
  const sub = d.ethicsSubmissions.find((e) => e.id === str(b.id, "id", { required: true }));
  if (!sub) throw errValidation("Ethics submission not found.");
  const action = str(b.action, "action", { required: true });

  if (action === "approve") {
    if (sub.status !== "SUBMITTED" && sub.status !== "UNDER_REVIEW") throw errConflict("Only submitted/under-review submissions can be approved.");
    const reason = str(b.reason, "rationale", { required: true });
    sub.status = "APPROVED";
    sub.approvedAt = nowIso();
    sub.expiresAt = addYears(nowIso(), 1);
    sub.reviewer = `${user.name} (Ethics Member)`;
    sub.rationale = reason;
    logAudit({ actor: user.name, role: user.role, entity: "Ethics submission", entityId: sub.id, action: "APPROVED", from: sub.status, to: "APPROVED", reason });
    notify({ title: `${sub.code} approved`, body: "Ethics KPI updated; site may proceed per approval.", link: "/ethics", roles: ["PI", "COORDINATOR", "ETHICS_MEMBER", "LEADERSHIP", "ADMIN"] });
    await persist();
    return ok({ message: `${sub.code} approved — ethics alert updated.` });
  }

  if (action === "renew") {
    if (sub.status !== "APPROVED" && sub.status !== "EXPIRED") throw errConflict("Only approved/expired submissions can be renewed.");
    const reason = str(b.reason, "rationale", { required: true });
    const from = sub.status;
    sub.status = "APPROVED";
    sub.approvedAt = sub.approvedAt ?? nowIso();
    sub.expiresAt = addYears(sub.expiresAt && new Date(sub.expiresAt).getTime() > Date.now() ? sub.expiresAt : nowIso(), 1);
    sub.reviewer = `${user.name} (Ethics Member)`;
    sub.rationale = `Renewal: ${reason}`;
    logAudit({ actor: user.name, role: user.role, entity: "Ethics submission", entityId: sub.id, action: "RENEWED", from, to: "APPROVED", reason: `Expiry extended to ${sub.expiresAt!.slice(0, 10)}. ${reason}` });
    notify({ title: `${sub.code} renewed`, body: `Ethics/CTRI alert count updated. New expiry ${sub.expiresAt!.slice(0, 10)}.`, link: "/ethics", roles: ["PI", "COORDINATOR", "ETHICS_MEMBER", "LEADERSHIP", "ADMIN"] });
    await persist();
    return ok({ message: `${sub.code} renewed — expiry extended; alert cleared.` });
  }

  throw errValidation(`Unknown ethics action "${action}".`);
});
