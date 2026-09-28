import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { body, ok, route } from "@/lib/api";
import { judgeProgress } from "@/lib/judge";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  requireUser();
  const d = db();
  if (!d.judge.startedAt) {
    d.judge.startedAt = nowIso();
    await persist();
  }
  return ok(judgeProgress());
});

export const POST = route(async (req: NextRequest) => {
  requireUser();
  const b = await body<{ path?: string }>(req);
  const d = db();
  if (!d.judge.startedAt) d.judge.startedAt = nowIso();
  if (b.path && typeof b.path === "string" && !d.judge.visited.includes(b.path)) {
    d.judge.visited.push(b.path);
    if (d.judge.visited.length > 60) d.judge.visited = d.judge.visited.slice(-40);
  }
  await persist();
  return ok(judgeProgress());
});
