import Link from "next/link";
import { redirect } from "next/navigation";
import { can, sessionUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { fmtDt } from "@/lib/util";
import { Card, CardHeader, EmptyState, PageHeader, cx } from "@/components/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AccessDenied } from "@/components/access";

export const dynamic = "force-dynamic";

const ENTITIES = ["ALL", "Consent", "Enrollment", "Screening", "Visit", "Safety event", "Query", "PV task", "Ethics submission", "CTRI record", "Lab result", "Monitoring finding", "Export"];

export default async function AuditPage({ searchParams }: { searchParams: { entity?: string } }) {
  const user = sessionUser();
  if (!user) redirect("/");
  if (!can(user.role, "audit.read")) {
    return <AccessDenied message="The audit trail is not available to Leadership accounts (aggregate KPIs only)." />;
  }
  const d = db();
  const entity = searchParams.entity ?? "ALL";
  const entries = d.auditLogs
    .filter((a) => entity === "ALL" || a.entity === entity)
    .slice(0, 120);

  return (
    <>
      <Breadcrumbs />
      <PageHeader
        title="Audit"
        sub="Application-level audit history — every important state change is recorded. This is not claimed to be WORM or tamper-proof storage."
        actions={
          <div className="flex flex-wrap gap-1.5">
            {ENTITIES.slice(0, 8).map((e) => (
              <Link key={e} href={`/audit?entity=${encodeURIComponent(e)}`}
                className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold", entity === e ? "bg-brand text-white" : "border border-stone-300 bg-white text-ink-soft hover:bg-stone-50")}>
                {e}
              </Link>
            ))}
          </div>
        }
      />
      <Card>
        <CardHeader title="Audit timeline" sub={`${entries.length} most recent entr${entries.length === 1 ? "y" : "ies"} · read-only for demo users · Actor · Role · Timestamp · Record · Action · Old → New · Reason`} />
        {entries.length === 0 ? (
          <EmptyState title="No audit entries for this filter." hint="Perform an action — an entry appears here instantly." />
        ) : (
          <ol className="divide-y divide-stone-100">
            {entries.map((a) => (
              <li key={a.id} className="grid grid-cols-1 gap-1 px-4 py-3 text-xs sm:grid-cols-[170px_1fr]">
                <div className="text-ink-mute">{fmtDt(a.at)}</div>
                <div>
                  <p className="text-ink-soft">
                    <strong className="text-ink">{a.actor}</strong> <span className="text-ink-mute">({a.role.replace(/_/g, " ")})</span>
                    {" · "}{a.entity} <span className="font-mono text-[11px] text-ink-soft">{a.entityId}</span>
                    {" · "}{a.action}
                    {a.from || a.to ? <>: <span className="font-semibold">{a.from ?? "—"}</span> → <span className="font-semibold">{a.to ?? "—"}</span></> : null}
                  </p>
                  {a.reason ? <p className="mt-0.5 italic text-ink-mute">Reason: {a.reason}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <p className="mt-3 text-[11px] text-ink-mute">
        Write flow: request → validate → authorize → apply state transition → write audit event → return updated state.
        In production this would be enforced server-side (Next.js server actions / RLS-backed Postgres) — the demo implements the same flow in local demo mode.
      </p>
    </>
  );
}
