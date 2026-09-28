import { sessionUser } from "@/lib/auth";
import { errForbidden } from "@/lib/errors";
import { db } from "@/lib/store";
import { trialReadiness } from "@/lib/kpi";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = sessionUser();
  if (!user) throw errForbidden("Not signed in.");
  return ok({
    trials: db().trials.map((t) => ({
      id: t.id, code: t.code, status: t.status, protocolVersion: t.protocolVersion,
      ctri: t.ctri.state, targetEnrollment: t.targetEnrollment,
      enrolled: db().enrollments.filter((e) => e.trialId === t.id).length + t.baseEnrolled,
      readiness: trialReadiness(t.id).state,
    })),
  });
});
