import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/store";
import {
  activeTrial, computeKpis, enrollmentBySite, ethicsCtriAlerts, queryStatusCounts,
  safetyTaskCounts, trialReadiness, trialTasks, visitCompletion,
} from "@/lib/kpi";
import { fmtD } from "@/lib/util";
import { AsOf, Card, CardHeader, DataTable, KpiCard, PageHeader, ReadinessBanner, StatusBadge } from "@/components/ui";
import { BarChartH, Donut, MilestoneTimeline } from "@/components/charts";
import { Breadcrumbs } from "@/components/breadcrumbs";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const user = sessionUser();
  if (!user) redirect("/");
  const d = db();
  const trial = activeTrial();
  const k = computeKpis(trial.id);
  const vc = visitCompletion(trial.id);
  const qs = queryStatusCounts(trial.id);
  const st = safetyTaskCounts();
  const readiness = trialReadiness(trial.id);
  const alerts = ethicsCtriAlerts(trial.id);
  const tasks = trialTasks(trial.id);

  const aggregateOnly = user.role === "LEADERSHIP";
  const links = {
    trials: "/trials",
    enrolled: aggregateOnly ? "/reports#enrollment" : "/participants?status=ENROLLED",
    queries: aggregateOnly ? "/reports#queries" : "/monitoring?tab=queries",
    safety: aggregateOnly ? "/reports#safety" : "/safety",
    ethics: "/ethics",
    missing: aggregateOnly ? "/reports" : "/ai-assist",
  };

  return (
    <>
      <Breadcrumbs />
      <PageHeader
        title="Trial Overview"
        sub={<>Trial <strong>{trial.code}</strong> · Protocol {trial.protocolVersion} · <AsOf /></>}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status="ACTIVE" /><span className="text-xs text-ink-mute">DEMO</span>
            <StatusBadge status={readiness.state === "READY_FOR_ENROLLMENT" ? "READY" : "BLOCKED"} />
            <StatusBadge status="APPROVED" />
            <StatusBadge status="REGISTERED" />
          </div>
        }
      />

      {!aggregateOnly ? (
        <Card className="mb-5">
          <CardHeader title="Judge Demo starting point" sub="90-second connected workflow — follow the walkthrough panel (bottom-left) or start here." />
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-xs text-ink-soft">
            <Link href="/trials/trial-026" className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 font-semibold text-brand hover:bg-brand-tint">1. Trial readiness →</Link>
            <Link href="/participants/p-AYU-0025?tab=enrollment" className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 font-semibold text-brand hover:bg-brand-tint">2. Participant AYU-0025 (blocked gate) →</Link>
            <Link href="/participants/p-AYU-0025?tab=consent" className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 font-semibold text-brand hover:bg-brand-tint">3. Accept consent → enroll →</Link>
            <span className="text-ink-mute">then SAE → PV → Query → Audit → Export. Every action updates KPIs + audit instantly.</span>
          </div>
        </Card>
      ) : null}

      {/* KPI grid — computed live from the store */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Active trials" value={k.activeTrials} sub="demo workspace" href={links.trials} tone="brand" />
        <KpiCard label="Enrolled" value={<>{k.enrolled} <span className="text-base font-normal text-ink-mute">/ {k.target}</span></>} sub={`${Math.round((k.enrolled / k.target) * 100)}% of target · ${trial.code}`} href={links.enrolled} tone="ok" />
        <KpiCard label="Open queries" value={k.openQueries} sub={`${qs.responded} responded · ${qs.resolved} resolved`} href={links.queries} tone="warn" />
        <KpiCard label="Safety follow-up" value={k.safetyFollowUp} sub={`${st.followUp} follow-up due · ${st.pending} completeness`} href={links.safety} tone="danger" />
        <KpiCard label="Ethics / CTRI alerts" value={k.ethicsAlerts} sub={alerts.ethics.length ? `${alerts.ethics.length} ethics · ${alerts.ctriAlerts.length} CTRI` : "no alerts"} href={links.ethics} tone={k.ethicsAlerts ? "warn" : "ok"} />
        <KpiCard label="Missing data" value={k.missingData} sub="expected visits/forms incomplete" href={links.missing} tone={k.missingData ? "warn" : "ok"} />
      </div>

      {/* charts row */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Enrollment by site" sub={`${k.enrolled} enrolled across ${trial.siteIds.length} sites`} />
          <BarChartH data={enrollmentBySite(trial.id).map((x) => ({ label: x.site.name, value: x.count }))} />
        </Card>
        <Card>
          <CardHeader title="Visit completion" sub={`${vc.completed} of ${vc.dueTotal} expected visits completed (${vc.pct}%)`} />
          <Donut title="Visit completion" centerLabel={`${vc.pct}%`} centerSub="completed"
            segments={[{ label: "Completed", value: vc.completed, tone: "ok" }, { label: "Overdue / expected", value: vc.overdue, tone: "danger" }]} />
        </Card>
        <Card>
          <CardHeader title="Query status" sub="monitoring lifecycle" />
          <Donut title="Query status" centerLabel={String(qs.open + qs.responded)} centerSub="open total"
            segments={[
              { label: "Open", value: qs.open, tone: "warn" },
              { label: "Responded", value: qs.responded, tone: "info" },
              { label: "Resolved", value: qs.resolved, tone: "ok" },
            ]} />
        </Card>
      </div>

      {/* tasks + readiness + audit */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader title="Open tasks" sub="derived from live records" />
          <ul className="divide-y divide-stone-100">
            {tasks.map((t) => (
              <li key={t.label} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-ink-soft">{t.label}</span>
                {aggregateOnly ? (
                  <span className="font-semibold text-ink">{t.count}</span>
                ) : (
                  <Link href={t.href} className="flex items-center gap-2 font-semibold text-ink hover:text-brand">
                    <StatusBadge status={t.count > 0 ? (t.tone === "danger" ? "OVERDUE" : "PENDING") : "COMPLETED"} /> {t.count}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Trial readiness" sub={trial.code} right={<Link href={`/trials/${trial.id}`} className="text-xs font-semibold text-brand hover:underline">Details →</Link>} />
          <div className="p-4">
            <ReadinessBanner state={readiness.state === "READY_FOR_ENROLLMENT" ? "READY" : "BLOCKED"} blockers={readiness.warnings} />
            <ul className="mt-3 space-y-1.5 text-xs">
              {readiness.rows.map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-2">
                  <span className={r.ok ? "text-ink-soft" : "font-medium text-danger"}>{r.ok ? "✓" : "✕"} {r.label}</span>
                  <span className="truncate text-[10px] text-ink-mute">{r.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent audit" sub="application-level audit history" right={!aggregateOnly ? <Link href="/audit" className="text-xs font-semibold text-brand hover:underline">Full trail →</Link> : undefined} />
          {aggregateOnly ? (
            <p className="px-4 py-6 text-center text-xs text-ink-mute">Record-level audit is hidden for Leadership (aggregate KPIs only).</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {d.auditLogs.slice(0, 5).map((a) => (
                <li key={a.id} className="px-4 py-2 text-xs">
                  <span className="font-medium text-ink">{a.actor}</span> <span className="text-ink-mute">· {a.entity}</span>
                  <span className="block text-ink-soft">{a.action}{a.from || a.to ? `: ${a.from ?? "—"} → ${a.to ?? "—"}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* trial timeline */}
      <Card className="mt-5">
        <CardHeader title="Trial timeline" sub="milestones from regulatory + operations records" />
        <MilestoneTimeline milestones={[
          { label: "CTRI registered (demo)", date: fmtD(trial.ctri.registeredAt), done: trial.ctri.state === "REGISTERED" },
          { label: "Ethics approval — Site 1", date: fmtD(d.ethicsSubmissions[0].approvedAt), done: true },
          { label: "First participant in", date: fmtD(d.enrollments[0]?.enrolledAt), done: true },
          { label: "Today", date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }), done: true, warn: true },
          { label: "CTRI renewal due", date: fmtD(trial.ctri.renewalDueAt), done: false, warn: true },
          { label: "Study end", date: fmtD(trial.endDate), done: false },
        ]} />
      </Card>
    </>
  );
}
