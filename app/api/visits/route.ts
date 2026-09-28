import { NextRequest } from "next/server";
import { assertSiteScope, requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { errConflict, errNotFound, errValidation } from "@/lib/errors";
import { body, isDate, ok, route, str } from "@/lib/api";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const user = requirePerm("visit.write");
  const b = await body<{ action?: string; id?: string; participantId?: string; type?: string; dueAt?: string }>(req);
  const d = db();

  if (b.action === "complete") {
    const visitId = str(b.id, "id", { required: true });
    const v = d.visits.find((x) => x.id === visitId);
    if (!v) throw errNotFound("Visit not found.");
    const p = d.participants.find((x) => x.id === v.participantId)!;
    assertSiteScope(user, p.siteId);
    if (v.status !== "SCHEDULED") throw errConflict("Visit is not in SCHEDULED state — it may already be completed.");
    const hasCrf = d.observations.some((o) => o.visitId === v.id);
    if (!hasCrf) throw errValidation("Required CRF incomplete: record the visit CRF observation before completing this visit.");
    v.status = "COMPLETED";
    v.completedAt = nowIso();
    v.completedBy = user.name;
    logAudit({ actor: user.name, role: user.role, entity: "Visit", entityId: v.id, action: "COMPLETED", from: "SCHEDULED", to: "COMPLETED", reason: `${v.type} visit completed for ${p.code}; completion KPI updated` });
    await persist();
    return ok({ message: `Visit ${v.type} completed for ${p.code}.` });
  }

  // create / schedule
  const participantId = str(b.participantId, "participantId", { required: true });
  const p = d.participants.find((x) => x.id === participantId);
  if (!p) throw errNotFound("Participant not found.");
  assertSiteScope(user, p.siteId);
  const type = str(b.type, "type", { required: true });
  if (!["BASELINE", "V1", "V2", "V3", "FOLLOW_UP"].includes(type)) throw errValidation("Unknown visit type.");
  const dueAt = isDate(b.dueAt);
  if (!dueAt) throw errValidation("Field \"dueAt\" must be a valid date.");

  const id = `v-${p.code}-${type}-${Date.now().toString(36)}`;
  d.visits.push({ id, participantId: p.id, trialId: p.trialId, type: type as never, dueAt, status: "SCHEDULED", completedAt: null, completedBy: null });
  logAudit({ actor: user.name, role: user.role, entity: "Visit", entityId: id, action: "SCHEDULED", to: "SCHEDULED", reason: `${type} visit scheduled for ${p.code}` });
  await persist();
  return ok({ message: `${type} visit scheduled for ${p.code}.`, id }, 201);
});
