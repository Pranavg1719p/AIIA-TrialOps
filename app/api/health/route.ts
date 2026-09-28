import { ok, route } from "@/lib/api";
import { storeModeLabel } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Public health check for hosting platforms (Render/UptimeRobot/…). No auth, no data. */
export const GET = route(async () => {
  return ok({
    status: "ok",
    app: "AIIA TrialOps",
    notice: "Synthetic demo data — not for clinical use",
    storage: storeModeLabel(),
    time: new Date().toISOString(),
  });
});
