import { NextRequest } from "next/server";
import { requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit, notify } from "@/lib/audit";
import { errConflict, errNotFound, errValidation } from "@/lib/errors";
import { body, ok, route, str } from "@/lib/api";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const b = await body<{ action?: string; language?: string; witness?: string | null; reason?: string | null }>(req);
  const action = str(b.action, "action", { required: true });
  const d = db();
  const p = d.participants.find((x) => x.id === params.id);
  if (!p) throw errNotFound("Participant not found.");
  const consent = d.consents.filter((c) => c.participantId === p.id).slice(-1)[0];
  if (!consent) throw errNotFound("No consent record exists for this participant.");

  if (action === "accept") {
    const user = requirePerm("consent.act");
    if (consent.status === "ACCEPTED") throw errConflict("Consent is already accepted — no further action needed.");
    const language = str(b.language, "language", { required: true });
    const from = consent.status;
    consent.status = "ACCEPTED";
    consent.language = language;
    consent.at = nowIso();
    consent.staff = user.name;
    consent.witness = (b.witness as string) || null;
    consent.signature = "Simulated (demo)";
    consent.reason = null;
    logAudit({ actor: user.name, role: user.role, entity: "Consent", entityId: consent.id, action: "ACCEPTED", from, to: "ACCEPTED", reason: `Consent accepted (${language}, ${consent.version}). Signature simulated — demo only.` });
    notify({ title: "Consent accepted — gate recomputed", body: `${p.code}: consent accepted; enrollment gate is now evaluated. Enroll from the participant profile.`, link: `/participants/${p.id}?tab=enrollment`, roles: ["PI", "COORDINATOR", "MONITOR", "ADMIN"] });
    await persist();
    return ok({ message: "Consent accepted — enrollment gate recomputed.", gate: "READY_TO_EVALUATE" });
  }

  if (action === "decline") {
    const user = requirePerm("consent.act");
    const reason = str(b.reason, "reason", { required: true });
    const from = consent.status;
    consent.status = "DECLINED";
    consent.at = nowIso();
    consent.staff = user.name;
    consent.signature = null;
    consent.reason = reason;
    logAudit({ actor: user.name, role: user.role, entity: "Consent", entityId: consent.id, action: "DECLINED", from, to: "DECLINED", reason });
    await persist();
    return ok({ message: "Consent declined and recorded." });
  }

  if (action === "withdraw") {
    const user = requirePerm("consent.withdraw");
    const reason = str(b.reason, "reason", { required: true });
    if (consent.status !== "ACCEPTED") throw errConflict("Only an accepted consent can be withdrawn.");
    consent.status = "WITHDRAWN";
    consent.at = nowIso();
    consent.staff = user.name;
    consent.reason = reason;
    consent.signature = "Simulated (demo)";
    logAudit({ actor: user.name, role: user.role, entity: "Consent", entityId: consent.id, action: "WITHDRAWN", from: "ACCEPTED", to: "WITHDRAWN", reason });
    await persist();
    return ok({ message: "Consent withdrawn — full history preserved." });
  }

  throw errValidation(`Unknown consent action "${action}". Use accept, decline or withdraw.`);
});
