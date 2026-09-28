import { requirePerm } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { persist, resetDb } from "@/lib/store";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const user = requirePerm("settings.manage", "Judge scenario control is restricted to the Admin role.");
  const fresh = resetDb();
  logAudit({
    actor: user.name, role: user.role, entity: "Demo data", entityId: "judge-scenario",
    action: "JUDGE_SCENARIO_LOADED", to: "SEEDED", reason:
      "Controlled scenario: blocked participant (AYU-0025), multi-blocker (AYU-0026), open SAE (SE-001), open query (Q-101, overdue), ethics warning (EC-026-C) + CTRI renewal alert.",
  });
  await persist();
  return ok({
    message: "Judge scenario loaded. Blocked participant, ready-after-fix participant, open SAE, open query and ethics warning are all in place.",
    walkthrough: "/overview → Judge Demo button (bottom-left)",
    seededAt: fresh.meta.seededAt,
  });
});
