import { NextRequest } from "next/server";
import { requirePerm, requireUser } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { errNotFound, errValidation } from "@/lib/errors";
import { body, ok, route, str } from "@/lib/api";
import { fmtDt, nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const PATCH = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const b = await body<{ itemKey?: string; done?: boolean; piReview?: boolean }>(req);

  if (b.piReview) {
    const user = requirePerm("screening.piReview", "Only the PI (or delegated reviewer) can record the eligibility review.");
    const scr = db().screenings.find((s) => s.participantId === params.id);
    if (!scr) throw errNotFound("Screening record not found.");
    const p = db().participants.find((x) => x.id === params.id)!;
    const from = scr.piReviewedAt ? "REVIEWED" : "PENDING";
    scr.piReviewedAt = nowIso();
    scr.piReviewedBy = `${user.name} (${user.role === "PI" ? "PI" : "delegate"})`;
    logAudit({ actor: user.name, role: user.role, entity: "Screening", entityId: p.id, action: "PI_REVIEW", from, to: "REVIEWED", reason: "Human eligibility decision against protocol v1.2" });
    await persist();
    requireUser();
    return ok({ message: "PI review recorded — enrollment gate recomputed." });
  }

  const user = requirePerm("screening.edit");
  const scr = db().screenings.find((s) => s.participantId === params.id);
  if (!scr) throw errNotFound("Screening record not found.");
  const itemKey = str(b.itemKey, "itemKey", { required: true });
  const item = scr.items.find((i) => i.key === itemKey);
  if (!item) throw errValidation(`Unknown checklist item "${itemKey}".`);
  if (typeof b.done !== "boolean") throw errValidation("Field \"done\" must be true or false.");
  const from = item.done ? "DONE" : "UNDONE";
  item.done = b.done;
  item.updatedAt = nowIso();
  item.updatedBy = user.name;

  const p = db().participants.find((x) => x.id === params.id)!;
  logAudit({ actor: user.name, role: user.role, entity: "Screening", entityId: p.id, action: b.done ? "CHECKLIST_ITEM_DONE" : "CHECKLIST_ITEM_UNDONE", from, to: b.done ? "DONE" : "UNDONE", reason: `Item: ${item.label}` });
  await persist();
  requireUser();
  return ok({ message: `Checklist updated (${fmtDt(nowIso())}).` });
});
