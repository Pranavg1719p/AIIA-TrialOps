import { NextRequest } from "next/server";
import { requirePerm } from "@/lib/auth";
import { db } from "@/lib/store";
import { ok, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const user = requirePerm("audit.read");
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 100, 300);
  const entity = req.nextUrl.searchParams.get("entity");
  const entries = db().auditLogs
    .filter((a) => !entity || a.entity === entity)
    .slice(0, limit);
  return ok({ auditLogs: entries, actor: user.name, note: "Application-level audit history — not a WORM/tamper-proof store." });
});
