import { NextRequest } from "next/server";
import { assertSiteScope, requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { errConflict, errValidation } from "@/lib/errors";
import { body, ok, route, str } from "@/lib/api";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const user = requirePerm("finding.act", "Only monitors (or the PI) record monitoring findings.");
  const b = await body<Record<string, unknown>>(req);
  const d = db();
  const siteId = str(b.siteId, "site", { required: true });
  assertSiteScope(user, siteId);
  const errors: Record<string, string> = {};
  const description = str(b.description, "description", { required: true });
  if (!description) errors.description = "Finding description is required.";
  const sourceContext = str(b.sourceContext, "source context", { required: true });
  if (!sourceContext) errors.sourceContext = "Source context is required (monitors never overwrite source data).";
  const severity = str(b.severity, "severity", { required: true });
  if (!["MINOR", "MAJOR", "NOTE"].includes(severity)) errors.severity = "Severity must be MINOR, MAJOR or NOTE.";
  if (Object.keys(errors).length) return Response.json({ error: "Validation failed — see field errors.", errors }, { status: 400 });

  const maxNum = d.findings.reduce((m, f) => Math.max(m, Number(f.code.replace("MF-", "")) || 0), 0);
  const code = `MF-${String(maxNum + 1).padStart(3, "0")}`;
  const id = `mf-${code.toLowerCase()}`;
  const participantId = (b.participantId as string) || null;
  d.findings.push({
    id, code, trialId: "trial-026", siteId, participantId,
    description, severity: severity as never, status: "OPEN", sourceContext,
    createdBy: `${user.name} (Monitor)`, createdAt: nowIso(),
  });
  logAudit({ actor: user.name, role: user.role, entity: "Monitoring finding", entityId: id, action: "CREATED", to: "OPEN", reason: `${code}: ${description.slice(0, 80)}` });
  await persist();
  return ok({ message: `${code} recorded.`, id, code }, 201);
});

export const PATCH = route(async (req: NextRequest) => {
  const user = requirePerm("finding.act");
  const b = await body<Record<string, unknown>>(req);
  const action = str(b.action, "action", { required: true });
  const d = db();
  const f = d.findings.find((x) => x.id === str(b.id, "id", { required: true }));
  if (!f) throw errValidation("Finding not found.");
  if (action === "acknowledge") {
    if (f.status !== "OPEN") throw errConflict("Finding is not OPEN.");
    f.status = "ACKNOWLEDGED";
    logAudit({ actor: user.name, role: user.role, entity: "Monitoring finding", entityId: f.id, action: "ACKNOWLEDGED", from: "OPEN", to: "ACKNOWLEDGED" });
    await persist();
    return ok({ message: `${f.code} acknowledged.` });
  }
  if (action === "close") {
    if (f.status === "CLOSED") throw errConflict("Finding is already closed.");
    const from = f.status;
    f.status = "CLOSED";
    logAudit({ actor: user.name, role: user.role, entity: "Monitoring finding", entityId: f.id, action: "CLOSED", from, to: "CLOSED" });
    await persist();
    return ok({ message: `${f.code} closed.` });
  }
  throw errValidation(`Unknown finding action "${action}".`);
});
