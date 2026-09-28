import Link from "next/link";
import { redirect } from "next/navigation";
import { can, sessionUser, visibleParticipants } from "@/lib/auth";
import { db } from "@/lib/store";
import { fmtD, fmtDt, isPast } from "@/lib/util";
import { Card, CardHeader, DataTable, EmptyState, PageHeader, StatusBadge, cx } from "@/components/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionButton } from "@/components/action";
import { FindingForm, QueryForm, QueryRespond } from "@/components/forms/safety";

export const dynamic = "force-dynamic";

const TABS: [string, string][] = [
  ["OPEN", "Open"], ["RESPONDED", "Responded"], ["RESOLVED", "Resolved"], ["OVERDUE", "Overdue"], ["ALL", "All"],
];

export default async function MonitoringPage({ searchParams }: { searchParams: { tab?: string } }) {
  const user = sessionUser();
  if (!user) redirect("/");
  if (!["ADMIN", "PI", "COORDINATOR", "MONITOR"].includes(user.role)) {
    return (
      <Card className="mx-auto my-10 max-w-lg">
        <EmptyState title="Monitoring workspace is limited to operations, quality and monitoring roles." />
      </Card>
    );
  }
  const d = db();
  const visible = new Set(visibleParticipants(user).map((p) => p.id));
  const inScope = (siteId: string) => (user.role === "MONITOR" ? user.siteScope.includes(siteId) : true);

  const tab = searchParams.tab ?? "OPEN";
  const queries = d.queries
    .filter((q) => inScope(q.siteId))
    .filter((q) => {
      if (tab === "ALL") return true;
      if (tab === "OVERDUE") return q.status !== "RESOLVED" && isPast(q.dueAt);
      return q.status === tab;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const findings = d.findings.filter((f) => inScope(f.siteId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const overdueCount = d.queries.filter((q) => inScope(q.siteId) && q.status !== "RESOLVED" && isPast(q.dueAt)).length;
  const assignedSites = d.sites.filter((s) => (user.role === "MONITOR" ? user.siteScope.includes(s.id) : true));
  const canQuery = can(user.role, "query.create");
  const canRespond = can(user.role, "query.respond");
  const canResolve = can(user.role, "query.resolve");
  const participantOptions = d.participants.filter((p) => visible.has(p.id)).map((p) => ({ id: p.id, code: p.code }));

  return (
    <>
      <Breadcrumbs />
      <PageHeader
        title="Monitoring & Queries"
        sub="Monitors review assigned sites, raise findings and queries, and close the loop. Source records stay read-only for monitors — the site responds; the reviewer resolves."
        actions={
          <div className="flex gap-1.5 text-[11px] text-ink-mute">
            <span className="rounded border border-stone-200 bg-white px-2 py-1">{assignedSites.length} assigned site(s)</span>
            <span className={cx("rounded border px-2 py-1", overdueCount ? "border-danger-line bg-danger-bg text-danger" : "border-ok-line bg-ok-bg text-ok")}>{overdueCount} overdue</span>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {canQuery ? (
          <Card>
            <CardHeader title="Raise a monitoring query" sub="Query lifecycle: OPEN → RESPONDED (site) → RESOLVED (reviewer)" />
            <QueryForm sites={assignedSites} participants={participantOptions} defaultSiteId={user.role === "MONITOR" ? user.siteScope[0] : undefined} />
          </Card>
        ) : (
          <Card>
            <CardHeader title="Your role in the query lifecycle" sub="Coordinator responsibilities" />
            <p className="p-4 text-xs text-ink-soft">
              Queries marked <StatusBadge status="OPEN" /> below expect your response: provide a response text plus source context.
              The monitor or PI then resolves the query. Overdue queries are flagged automatically from due dates.
            </p>
          </Card>
        )}
        <Card>
          <CardHeader title="Record a monitoring finding" sub={canQuery ? "Findings are non-query observations (deviations, notes, source issues)" : "Findings recorded during monitoring visits"} />
          {canQuery ? (
            <FindingForm sites={assignedSites} participants={participantOptions} defaultSiteId={user.role === "MONITOR" ? user.siteScope[0] : undefined} />
          ) : (
            <p className="p-4 text-xs text-ink-mute">Only monitors and the PI record findings.</p>
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Queries"
          sub={`${queries.length} in view · lifecycle OPEN → RESPONDED → RESOLVED`}
          right={
            <div className="flex flex-wrap gap-1.5">
              {TABS.map(([k, label]) => (
                <Link key={k} href={`/monitoring?tab=${k}`}
                  className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold", tab === k ? "bg-brand text-white" : "border border-stone-300 bg-white text-ink-soft hover:bg-stone-50")}>
                  {label}
                </Link>
              ))}
            </div>
          }
        />
        {queries.length === 0 ? (
          <EmptyState title="No queries in this view." hint="“No open queries.” is the healthy state." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {queries.map((q) => {
              const overdue = q.status !== "RESOLVED" && isPast(q.dueAt);
              const subject = q.participantId ? d.participants.find((p) => p.id === q.participantId)?.code : null;
              return (
                <li key={q.id} className="space-y-2 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-ink">{q.code}</span>
                      <StatusBadge status={overdue ? "OVERDUE" : q.status} />
                      <span className="text-xs text-ink-mute">
                        {q.category}{subject ? <> · <Link href={`/participants/${q.participantId}?tab=queries`} className="font-medium text-brand hover:underline">{subject}</Link></> : " · site-level"} · due {fmtD(q.dueAt)} · raised by {q.createdBy} · {fmtDt(q.createdAt)}
                      </span>
                    </div>
                    <div className="flex gap-1.5">
                      {canRespond && q.status === "OPEN" ? <span className="text-[11px] text-ink-mute">Awaiting your response ↓</span> : null}
                      {canResolve && q.status === "RESPONDED" ? (
                        <ActionButton url="/api/queries" body={{ id: q.id, action: "resolve" }} label="Resolve query" small
                          reason="Resolution note (reviewer closes the query)" success="Query resolved — KPI updated." />
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm text-ink-soft">{q.question}</p>
                  {q.response ? (
                    <div className="rounded-md border border-info-line bg-info-bg p-2.5 text-xs text-ink-soft">
                      <p><strong>Site response</strong> ({fmtDt(q.response.at)} · {q.response.by}): {q.response.text}</p>
                      <p className="mt-1 text-ink-mute">Source context: {q.response.sourceContext}</p>
                    </div>
                  ) : null}
                  {q.resolution ? (
                    <div className="rounded-md border border-ok-line bg-ok-bg p-2.5 text-xs text-ink-soft">
                      <p><strong>Resolved</strong> ({fmtDt(q.resolution.at)} · {q.resolution.by}): {q.resolution.note}</p>
                    </div>
                  ) : null}
                  {canRespond && q.status === "OPEN" ? <QueryRespond queryId={q.id} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-5">
        <CardHeader title="Findings" sub="Monitoring findings at your assigned site(s)" />
        {findings.length === 0 ? <EmptyState title="No findings recorded." /> : (
          <DataTable head={["Code", "Severity", "Description", "Subject", "Source context", "Status", "Actions"]}>
            {findings.map((f) => {
              const subject = f.participantId ? d.participants.find((p) => p.id === f.participantId)?.code : "—";
              return (
                <tr key={f.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{f.code}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={f.severity} /></td>
                  <td className="px-4 py-2.5 max-w-[280px] text-xs text-ink-soft">{f.description}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{subject}</td>
                  <td className="px-4 py-2.5 text-[11px] text-ink-mute">{f.sourceContext}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={f.status} /></td>
                  <td className="px-4 py-2.5">
                    {can(user.role, "finding.act") && f.status !== "CLOSED" ? (
                      <ActionButton url="/api/monitoring" body={{ id: f.id, action: f.status === "OPEN" ? "acknowledge" : "close" }}
                        label={f.status === "OPEN" ? "Acknowledge" : "Close"} small
                        success={f.status === "OPEN" ? "Finding acknowledged." : "Finding closed."} />
                    ) : <span className="text-[11px] text-ink-mute">—</span>}
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </Card>
    </>
  );
}
