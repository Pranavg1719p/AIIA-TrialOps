import { NextRequest } from "next/server";
import { assertSiteScope, requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit, notify } from "@/lib/audit";
import { errValidation } from "@/lib/errors";
import { body, isDate, ok, route, str } from "@/lib/api";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const user = requirePerm("lab.write");
  const b = await body<Record<string, unknown>>(req);
  const d = db();
  const participantId = str(b.participantId, "participantId", { required: true });
  const p = d.participants.find((x) => x.id === participantId);
  if (!p) throw errValidation("Unknown participant.");
  assertSiteScope(user, p.siteId);

  const test = str(b.test, "test", { required: true });
  const value = Number(b.value);
  const unit = str(b.unit, "unit", { required: true });
  const refLow = Number(b.refLow);
  const refHigh = Number(b.refHigh);
  const collectedAt = isDate(b.collectedAt);
  const status = b.status === "PENDING" ? "PENDING" : "FINAL";

  if (!test) throw errValidation("Test name is required.");
  if (Number.isNaN(value)) throw errValidation("Value must be a number.");
  if (!unit) throw errValidation("Unit is required.");
  if (Number.isNaN(refLow) || Number.isNaN(refHigh)) throw errValidation("Reference range (low/high) is required.");
  if (refLow >= refHigh) throw errValidation("Reference range invalid: low must be less than high.");
  if (!collectedAt) throw errValidation("Collection date is required.");
  if (new Date(collectedAt).getTime() > Date.now() + 60000) throw errValidation("Collection date cannot be in the future.");

  const outOfRange = value < refLow || value > refHigh;
  const id = `lab-${p.code}-${Date.now().toString(36)}`;
  d.labResults.push({
    id, participantId: p.id, visitId: (b.visitId as string) || null,
    test, value, unit, refLow, refHigh, collectedAt, status,
    flag: outOfRange ? "OUT_OF_RANGE" : null, createdBy: user.name, createdAt: nowIso(),
  });

  if (outOfRange) {
    notify({ title: "Out-of-range result — human review required", body: `${p.code}: ${test} ${value} ${unit} (ref ${refLow}–${refHigh}). The system does not interpret results; human review is required.`, link: `/participants/${p.id}?tab=labs`, roles: ["PI", "MONITOR", "COORDINATOR", "PV_OFFICER", "ADMIN"] });
  }
  logAudit({ actor: user.name, role: user.role, entity: "Lab result", entityId: id, action: outOfRange ? "RECORDED_OUT_OF_RANGE" : "RECORDED", to: status, reason: `${test} ${value} ${unit} for ${p.code}${outOfRange ? " — flagged: out-of-range result, human review required" : ""}` });
  await persist();
  return ok({ message: outOfRange ? "Lab saved — out-of-range result. Human review required (no automated interpretation)." : "Lab result saved.", id, outOfRange }, 201);
});
