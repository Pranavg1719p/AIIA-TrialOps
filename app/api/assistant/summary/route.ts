import { requirePerm } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { persist } from "@/lib/store";
import { ok, route } from "@/lib/api";
import { aggregateSummary } from "@/lib/assistant";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const user = requirePerm("assistant.read");
  const { draft, inputs } = aggregateSummary();
  logAudit({
    actor: user.name, role: user.role, entity: "Assistant summary", entityId: "trial-026",
    action: "SUMMARY_GENERATED", to: "DRAFT",
    reason: "Aggregate-only inputs (counts/KPIs). No participant-level data used. Draft requires PI review.",
  });
  await persist();
  return ok({ draft, inputs, label: "AI-generated draft — PI review required." });
});
