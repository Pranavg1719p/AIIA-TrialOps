import { NextRequest } from "next/server";
import { can, requirePerm, requireUser, sessionUser, visibleParticipants } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit, notify } from "@/lib/audit";
import { errConflict, errForbidden, errValidation } from "@/lib/errors";
import { body, ok, route, str } from "@/lib/api";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = sessionUser();
  if (!user) throw errForbidden("Not signed in.");
  if (!can(user.role, "participant.read")) throw errForbidden("Leadership accounts receive aggregate data only — participant-level access denied.");
  const list = visibleParticipants(user).map((p) => ({
    id: p.id, code: p.code, siteId: p.siteId, status: p.status,
    consent: db().consents.filter((c) => c.participantId === p.id).slice(-1)[0]?.status ?? "NO_RECORD",
    enrolledAt: db().enrollments.find((e) => e.participantId === p.id)?.enrolledAt ?? null,
  }));
  return ok({ participants: list, scope: user.role === "MONITOR" ? "ASSIGNED_SITES" : "ALL_ASSIGNED" });
});

export const POST = route(async (req: NextRequest) => {
  const user = requirePerm("participant.create");
  const b = await body<{ code?: string; siteId?: string }>(req);
  const code = str(b.code, "subject code", { required: true, max: 20 }).toUpperCase();
  if (!/^AYU-\d{4}$/.test(code)) throw errValidation("Subject code must match the synthetic format AYU-#### — real identifiers are not permitted in this system.");
  const siteId = str(b.siteId, "site", { required: true });
  const site = db().sites.find((s) => s.id === siteId);
  if (!site) throw errValidation("Unknown site.");
  if (db().participants.some((p) => p.trialId === "trial-026" && p.code === code)) {
    throw errConflict(`Screening blocked: subject code ${code} already exists in trial AIIA-AYU-026-DEMO.`);
  }

  const participant = { id: `p-${code}`, trialId: "trial-026", siteId, code, status: "SCREENING" as const, createdAt: nowIso(), createdBy: user.name };
  db().participants.push(participant);
  db().screenings.push({
    participantId: participant.id, notes: "",
    piReviewedAt: null, piReviewedBy: null,
    items: [
      { key: "eligibilityReviewed", label: "Eligibility reviewed", done: false, updatedAt: null, updatedBy: null },
      { key: "inclusion", label: "Inclusion criteria confirmed", done: false, updatedAt: null, updatedBy: null },
      { key: "exclusion", label: "Exclusion criteria confirmed", done: false, updatedAt: null, updatedBy: null },
      { key: "protocolAssessment", label: "Protocol-specific assessment completed", done: false, updatedAt: null, updatedBy: null },
    ],
  });
  db().consents.push({ id: `c-${code}`, participantId: participant.id, version: "ICF v1.2 (EC-approved demo)", language: "English", status: "PENDING", at: nowIso(), staff: user.name, witness: null, signature: null, reason: null });

  logAudit({ actor: user.name, role: user.role, entity: "Participant", entityId: participant.id, action: "SCREENING_CREATED", to: "SCREENING", reason: "New screening record" });
  notify({ title: "New screening record", body: `${code} added at ${site.name}. Consent and eligibility checks are pending.`, link: `/participants/${participant.id}?tab=screening`, roles: ["PI", "COORDINATOR", "MONITOR", "ADMIN"] });
  await persist();
  requireUser();
  return ok({ participant: { id: participant.id, code } }, 201);
});
