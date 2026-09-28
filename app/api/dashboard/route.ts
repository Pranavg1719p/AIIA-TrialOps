import { sessionUser } from "@/lib/auth";
import { errForbidden } from "@/lib/errors";
import { computeKpis, trialTasks, visitCompletion, queryStatusCounts, enrollmentBySite, safetyTaskCounts } from "@/lib/kpi";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = sessionUser();
  if (!user) throw errForbidden("Not signed in.");
  const trialId = "trial-026";
  return ok({
    kpis: computeKpis(trialId),
    tasks: trialTasks(trialId),
    visitCompletion: visitCompletion(trialId),
    queryStatus: queryStatusCounts(trialId),
    enrollmentBySite: enrollmentBySite(trialId).map((x) => ({ site: x.site.code, count: x.count })),
    safetyTasks: safetyTaskCounts(),
    role: user.role,
  });
});
