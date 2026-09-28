import { NextRequest } from "next/server";
import { requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit, notify } from "@/lib/audit";
import { errValidation } from "@/lib/errors";
import { body, ok, route, str } from "@/lib/api";
import { completenessFindings } from "@/lib/assistant";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  requirePerm("assistant.read");
  return ok({ findings: completenessFindings(false), dismissed: db().assistant.dismissed });
});

export const POST = route(async (req: NextRequest) => {
  const user = requirePerm("assistant.act", "Coordinator or PI decide on assistant findings — humans only.");
  const b = await body<{ action?: string; key?: string; actionText?: string; reason?: string }>(req);
  const action = str(b.action, "action", { required: true });
  const key = str(b.key, "key", { required: true });
  const all = completenessFindings(true);
  const f = all.find((x) => x.key === key);
  if (!f) throw errValidation("Unknown finding key — the rule set may have changed. Refresh and retry.");
  const d = db();

  if (action === "accept") {
    const actionText = str(b.actionText, "actionText") || f.suggestion;
    d.assistant.accepted.unshift({ key, at: nowIso(), by: user.name, action: actionText });
    notify({ title: "Corrective task logged", body: `Completeness assistant finding accepted: ${actionText}`, link: "/overview", roles: ["COORDINATOR", "PI", "ADMIN"] });
    logAudit({ actor: user.name, role: user.role, entity: "Assistant finding", entityId: key, action: "ACCEPTED", to: "TASK_LOGGED", reason: `Human accepted rule suggestion: ${actionText}` });
    await persist();
    return ok({ message: "Accepted — corrective task logged to the coordinator queue." });
  }

  if (action === "dismiss") {
    const reason = str(b.reason, "reason", { required: true });
    d.assistant.dismissed.push(key);
    logAudit({ actor: user.name, role: user.role, entity: "Assistant finding", entityId: key, action: "DISMISSED", to: "DISMISSED", reason: `Human dismissed rule finding: ${reason}` });
    await persist();
    return ok({ message: "Finding dismissed (kept in dismissed history)." });
  }

  throw errValidation(`Unknown assistant action "${action}".`);
});
