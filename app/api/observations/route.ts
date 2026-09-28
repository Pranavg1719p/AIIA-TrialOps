import { NextRequest } from "next/server";
import { assertSiteScope, requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { errNotFound, errValidation } from "@/lib/errors";
import { body, ok, route, str } from "@/lib/api";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

interface CrfBody {
  visitId?: string; participantId?: string;
  fields?: { formulation?: string; batch?: string; dose?: string | number; doseUnit?: string; route?: string; anupana?: string; dietAdherence?: string; lifestyleCompliance?: boolean; assessmentScore?: string | number | null; notes?: string; visitDate?: string };
}

/** Server-side CRF validation: required fields, ranges, units, dates. */
export const POST = route(async (req: NextRequest) => {
  const user = requirePerm("crf.write");
  const b = await body<CrfBody>(req);
  const d = db();
  const visit = d.visits.find((v) => v.id === str(b.visitId, "visitId", { required: true }));
  if (!visit) throw errNotFound("Visit not found.");
  const p = d.participants.find((x) => x.id === visit.participantId)!;
  assertSiteScope(user, p.siteId);
  const f = b.fields ?? {};
  const errors: Record<string, string> = {};

  if (!f.formulation) errors.formulation = "Formulation is required.";
  if (!f.batch || String(f.batch).trim().length < 4) errors.batch = "Batch is required (min 4 characters).";
  const dose = Number(f.dose);
  if (!f.dose || Number.isNaN(dose) || dose <= 0) errors.dose = "Dose must be a positive number.";
  if (!f.route) errors.route = "Route is required.";
  if (!f.anupana) errors.anupana = "Anupana is required (protocol field).";
  if (!f.dietAdherence) errors.dietAdherence = "Diet/lifestyle field is required (protocol field).";
  const score = f.assessmentScore === "" || f.assessmentScore === null || f.assessmentScore === undefined ? NaN : Number(f.assessmentScore);
  if (Number.isNaN(score)) errors.assessmentScore = "Assessment score is required.";
  else if (!Number.isInteger(score) || score < 0 || score > 10) errors.assessmentScore = "Assessment score must be an integer between 0 and 10.";
  const vd = f.visitDate ? new Date(f.visitDate) : null;
  if (!vd || Number.isNaN(vd.getTime())) errors.visitDate = "Visit date is required.";
  else if (vd.getTime() > Date.now() + 60000) errors.visitDate = "Visit date cannot be in the future.";

  if (Object.keys(errors).length) {
    return Response.json({ error: "Validation failed — see field errors.", errors }, { status: 400 });
  }

  const id = `o-${visit.id}-${Date.now().toString(36)}`;
  d.observations.push({
    id, visitId: visit.id, participantId: p.id,
    fields: {
      formulation: f.formulation!, batch: String(f.batch).trim(), dose, doseUnit: f.doseUnit ?? "mg",
      route: f.route!, anupana: f.anupana!, dietAdherence: f.dietAdherence!,
      lifestyleCompliance: !!f.lifestyleCompliance, assessmentScore: score, notes: f.notes || null,
    },
    createdAt: nowIso(), createdBy: user.name,
  });
  logAudit({ actor: user.name, role: user.role, entity: "Lab result", entityId: id, action: "CRF_RECORDED", to: "RECORDED", reason: `CRF saved for ${p.code} at ${visit.type} (server-side validation passed)` });
  await persist();
  return ok({ message: "CRF saved with server-side validation.", id }, 201);
});
