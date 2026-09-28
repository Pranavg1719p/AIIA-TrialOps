import { redirect } from "next/navigation";
import { can, sessionUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { ethicsCtriAlerts } from "@/lib/kpi";
import { daysUntil, fmtD, fmtDt } from "@/lib/util";
import { Card, CardHeader, DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { MilestoneTimeline } from "@/components/charts";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CtriActions, EthicsActions } from "@/components/forms/ops";

export const dynamic = "force-dynamic";

function ExpiryChip({ expiresAt, status }: { expiresAt: string | null; status: string }) {
  if (!expiresAt) return <span className="text-xs text-ink-mute">—</span>;
  const days = daysUntil(expiresAt);
  if (status === "EXPIRED" || days < 0) return <StatusBadge status="EXPIRED" />;
  if (days <= 30) return <StatusBadge status="OVERDUE" />;
  return <span className="text-xs text-ink-soft">{fmtD(expiresAt)} · valid</span>;
}

export default async function EthicsPage() {
  const user = sessionUser();
  if (!user) redirect("/");
  const d = db();
  const canAct = can(user.role, "ethics.act");
  const alerts = ethicsCtriAlerts("trial-026");

  return (
    <>
      <Breadcrumbs />
      <PageHeader
        title="Ethics & CTRI Tracker"
        sub="Submission → under review → approved / registered → expiry warning → renew / update. Decisions are made by demo users; nothing is submitted to external systems."
        actions={
          alerts.total > 0 ? (
            <span className="rounded-md border border-warn-line bg-warn-bg px-2.5 py-1.5 text-xs font-semibold text-warn">▲ {alerts.total} active alert(s)</span>
          ) : (
            <span className="rounded-md border border-ok-line bg-ok-bg px-2.5 py-1.5 text-xs font-semibold text-ok">✓ No alerts</span>
          )
        }
      />

      {alerts.total > 0 ? (
        <div className="mb-5 rounded-lg border border-warn-line bg-warn-bg p-3 text-sm text-warn" role="alert">
          <p className="font-semibold">▲ Action needed:</p>
          <ul className="ml-4 list-disc text-xs">
            {alerts.ethics.map((e) => <li key={e.id}>{e.code} ({e.status}) — renewal required before further enrollment at {d.sites.find((s) => s.id === e.siteId)?.name}.</li>)}
            {alerts.ctriAlerts.map((c) => <li key={c}>{c}</li>)}
          </ul>
          {canAct ? <p className="mt-1 text-[11px] italic text-warn/90">Ethics Member can record a renewal below — the alert clears and KPIs update instantly.</p> : null}
        </div>
      ) : null}

      <Card>
        <CardHeader title="Ethics submissions" sub="IEC approvals per site — demo documents only" />
        <DataTable head={["Code", "Site", "Document", "Submitted", "Approved", "Expiry", "Status", "Reviewer / rationale", canAct ? "Actions" : ""]}>
          {d.ethicsSubmissions.map((e) => (
            <tr key={e.id} className={e.status === "EXPIRED" ? "bg-danger-bg/40" : "hover:bg-stone-50"}>
              <td className="px-4 py-2.5 font-mono text-xs font-semibold">{e.code}</td>
              <td className="px-4 py-2.5 text-xs text-ink-soft">{d.sites.find((s) => s.id === e.siteId)?.name}</td>
              <td className="px-4 py-2.5 max-w-[200px] truncate text-xs text-ink-soft" title={e.docName}>{e.docName}</td>
              <td className="px-4 py-2.5 text-xs">{fmtD(e.submittedAt)}</td>
              <td className="px-4 py-2.5 text-xs">{e.approvedAt ? fmtD(e.approvedAt) : "—"}</td>
              <td className="px-4 py-2.5"><ExpiryChip expiresAt={e.expiresAt} status={e.status} /></td>
              <td className="px-4 py-2.5"><StatusBadge status={e.status} /></td>
              <td className="px-4 py-2.5 max-w-[220px] text-[11px] text-ink-mute">{e.reviewer ?? "—"}{e.rationale ? ` — ${e.rationale}` : ""}</td>
              {canAct ? <td className="px-4 py-2.5"><EthicsActions id={e.id} status={e.status} /></td> : null}
            </tr>
          ))}
        </DataTable>
        {!canAct ? <p className="px-4 py-2.5 text-[11px] text-ink-mute">Approvals and renewals are recorded by the Ethics Member role (login as ethics@demo.local to act).</p> : null}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {d.trials.map((t) => (
          <Card key={t.id}>
            <CardHeader title={`CTRI — ${t.code}`} sub="DRAFT → REF → REGISTERED are distinct states; REF is never final registration" right={<StatusBadge status={t.ctri.state} />} />
            <div className="space-y-2 p-4 text-xs text-ink-soft">
              <p>Ref: <span className="font-mono">{t.ctri.ref ?? "—"}</span></p>
              <p>Registered: {t.ctri.registeredAt ? fmtDt(t.ctri.registeredAt) : "—"} · Renewal due: {t.ctri.renewalDueAt ? fmtD(t.ctri.renewalDueAt) : "—"}</p>
              <p className="rounded-md border border-stone-200 bg-stone-50 p-2 text-[11px] text-ink-mute">External submission: MOCKED — production integration required.</p>
              {can(user.role, "ctri.act") ? <CtriActions trialId={t.id} state={t.ctri.state} /> : null}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-5">
        <CardHeader title="Regulatory timeline — AIIA-AYU-026-DEMO" sub="Submission → under review → approved / registered → expiry warning → renew" />
        <MilestoneTimeline milestones={[
          { label: "EC-026-A submitted", date: fmtD(d.ethicsSubmissions[0].submittedAt), done: true },
          { label: "EC-026-A approved", date: fmtD(d.ethicsSubmissions[0].approvedAt), done: true },
          { label: "CTRI registered (demo)", date: fmtD(d.trials[0].ctri.registeredAt), done: true },
          { label: "EC-026-C expiry", date: "16 Sep 2026 (EXPIRED)", done: false, warn: true },
          { label: "CTRI renewal due", date: fmtD(d.trials[0].ctri.renewalDueAt), done: false, warn: true },
          { label: "Renew / update", date: "pending action", done: false },
        ]} />
      </Card>
    </>
  );
}
