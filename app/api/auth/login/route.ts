import { NextRequest, NextResponse } from "next/server";
import { DEMO_PASSWORD, SESSION_COOKIE } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { errForbidden } from "@/lib/errors";
import { body, ok, route, str } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/util";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const b = await body<{ email?: string; password?: string; role?: string }>(req);
  let user = null as null | User;

  if (b.role) {
    user = db().users.find((u) => u.role === b.role) ?? null;
    if (!user) throw errForbidden("Unknown demo role.");
  } else {
    const email = str(b.email, "email", { required: true }).toLowerCase();
    const password = str(b.password, "password", { required: true });
    if (password !== DEMO_PASSWORD) throw errForbidden("Invalid email or password. (Demo password: demo1234)");
    user = db().users.find((u) => u.email === email) ?? null;
    if (!user) throw errForbidden("Invalid email or password.");
  }

  logAudit({ actor: user.name, role: user.role, entity: "Session", entityId: user.id, action: "SIGN_IN", to: "SIGNED_IN", reason: "Demo login (LOCAL DEMO MODE — simulated auth)" });

  const res = ok({ user: { name: user.name, role: user.role, roleLabel: ROLE_LABEL[user.role] } });
  res.cookies.set(SESSION_COOKIE, user.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86400 });
  return res;
});
