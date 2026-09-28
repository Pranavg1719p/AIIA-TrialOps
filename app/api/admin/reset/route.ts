import { requirePerm } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { persist, resetDb } from "@/lib/store";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const user = requirePerm("settings.manage", "Reset is restricted to the Admin role.");
  const fresh = resetDb();
  // the fresh store is active; write an audit entry into it so the reset itself is traceable
  logAudit({ actor: user.name, role: user.role, entity: "Demo data", entityId: "workspace", action: "RESET", to: "SEEDED", reason: "Demo data reset to original seeded state for repeated presentations." });
  await persist();
  return ok({
    message: "Demo data reset to the original seeded state.",
    seededAt: fresh.meta.seededAt,
    artifacts: ["24 enrolled participants", "AYU-0025 blocked on consent", "AYU-0026 multi-blocker screening", "Open SAE (SE-001)", "5 open queries (1 overdue)", "Ethics expiry + CTRI renewal alerts"],
  });
});
