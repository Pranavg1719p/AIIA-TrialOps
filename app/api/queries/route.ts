import { NextRequest } from "next/server";
import { assertSiteScope, requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit, notify } from "@/lib/audit";
import { errConflict, errNotFound, errValidation } from "@/lib/errors";
import { body, isDate, ok, route, str } from "@/lib/api";
import { nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const user = requirePerm("query.create");
  const b = await body<Record<string, unknown>>(req);
  const d = db();
  const siteId = str(b.siteId, "site", { required: true });
  assertSiteScope(user, siteId);
  const participantId = (b.participantId as string) || null;
  const p = participantId ? d.participants.find((x) => x.id === participantId) : null;
  if (participantId && !p) throw errValidation("Unknown participant.");
  const errors: Record<string, string> = {};
  const question = str(b.question, "question", { required: true });
  if (!question) errors.question = "Question text is required.";
  const dueAt = isDate(b.dueAt);
  if (!dueAt) errors.dueAt = "Response due date is required.";
  if (Object.keys(errors).length) return Response.json({ error: "Validation failed — see field errors.", errors }, { status: 400 });

  const maxNum = d.queries.reduce((m, q) => Math.max(m, Number(q.code.replace("Q-", "")) || 0), 100);
  const code = `Q-${maxNum + 1}`;
  const id = `q-${code.toLowerCase()}`;
  d.queries.push({
    id, code, trialId: "trial-026", siteId,
    participantId: p?.id ?? null, visitId: null,
    category: str(b.category, "category") || "Data",
    question, dueAt: dueAt!, status: "OPEN",
    createdBy: `${user.name} (${user.role === "MONITOR" ? "Monitor" : "PI"})`, createdAt: nowIso(),
    response: null, resolution: null,
  });
  logAudit({ actor: user.name, role: user.role, entity: "Query", entityId: id, action: "CREATED", to: "OPEN", reason: `${code} raised${p ? ` on ${p.code}` : ""} — open-queries KPI updated` });
  notify({ title: `Query ${code} raised`, body: `${p ? p.code : "Site-level"}: ${question.slice(0, 90)}… Response due ${dueAt!.slice(0, 10)}.`, link: "/monitoring?tab=queries", roles: ["COORDINATOR", "PI", "MONITOR", "ADMIN"] });
  await persist();
  return ok({ message: `${code} raised — coordinator queue and KPI updated.`, id, code }, 201);
});

export const PATCH = route(async (req: NextRequest) => {
  const b = await body<Record<string, unknown>>(req);
  const action = str(b.action, "action", { required: true });
  const d = db();
  const q = d.queries.find((x) => x.id === str(b.id, "id", { required: true }));
  if (!q) throw errNotFound("Query not found.");

  if (action === "respond") {
    const user = requirePerm("query.respond");
    if (q.status !== "OPEN") throw errConflict(`Query is ${q.status} — only OPEN queries can be responded to.`);
    const errors: Record<string, string> = {};
    const text = str(b.text, "response text", { required: true });
    if (!text) errors.text = "Response text is required.";
    const ctx = str(b.sourceContext, "source context", { required: true });
    if (!ctx) errors.sourceContext = "Source context is required (which source record supports the response).";
    if (Object.keys(errors).length) return Response.json({ error: "Validation failed — see field errors.", errors }, { status: 400 });
    q.response = { text, sourceContext: ctx, at: nowIso(), by: user.name };
    q.status = "RESPONDED";
    logAudit({ actor: user.name, role: user.role, entity: "Query", entityId: q.id, action: "RESPONDED", from: "OPEN", to: "RESPONDED", reason: `${q.code}: site response with source context — awaiting reviewer resolution` });
    notify({ title: `${q.code} responded`, body: "Site response recorded with source context. Reviewer can now resolve the query.", link: "/monitoring?tab=queries", roles: ["MONITOR", "PI", "ADMIN"] });
    await persist();
    return ok({ message: "Response recorded — awaiting reviewer resolution." });
  }

  if (action === "resolve") {
    const user = requirePerm("query.resolve");
    if (q.status === "RESOLVED") throw errConflict("Query is already resolved.");
    if (q.status !== "RESPONDED") throw errConflict("Query lifecycle requires a site response before resolution (OPEN → RESPONDED → RESOLVED).");
    const note = str(b.reason, "resolution note", { required: true });
    q.resolution = { note, at: nowIso(), by: user.name };
    q.status = "RESOLVED";
    logAudit({ actor: user.name, role: user.role, entity: "Query", entityId: q.id, action: "RESOLVED", from: "RESPONDED", to: "RESOLVED", reason: `${q.code} resolved by reviewer: ${note}` });
    notify({ title: `${q.code} resolved`, body: "Open-queries KPI updated.", link: "/monitoring?tab=queries", roles: ["COORDINATOR", "PI", "MONITOR", "LEADERSHIP", "ADMIN"] });
    await persist();
    return ok({ message: "Query resolved — open-queries KPI updated." });
  }

  throw errValidation(`Unknown query action "${action}".`);
});
