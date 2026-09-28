import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { body, ok, route, str } from "@/lib/api";
import { fmtDt } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = requireUser();
  const list = db().notifications
    .filter((n) => n.roles.includes(user.role))
    .slice(0, 12)
    .map((n) => ({ id: n.id, title: n.title, body: n.body, link: n.link, at: fmtDt(n.at), read: n.readBy.includes(user.role) }));
  return ok({ notifications: list });
});

export const POST = route(async (req: NextRequest) => {
  const user = requireUser();
  const b = await body<{ action?: string }>(req);
  if (str(b.action, "action", { required: true }) !== "readAll") {
    return ok({ message: "No-op." });
  }
  for (const n of db().notifications) {
    if (n.roles.includes(user.role) && !n.readBy.includes(user.role)) n.readBy.push(user.role);
  }
  await persist();
  return ok({ message: "All notifications marked read." });
});
