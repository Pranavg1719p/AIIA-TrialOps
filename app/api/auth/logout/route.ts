import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { persist } from "@/lib/store";
import { route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = route(async () => {
  const u = sessionUser();
  if (u) {
    logAudit({ actor: u.name, role: u.role, entity: "Session", entityId: u.id, action: "SIGN_OUT", to: "SIGNED_OUT" });
    await persist();
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
});
