import { notFound, redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { activeTrial, ethicsCtriAlerts, trialReadiness } from "@/lib/kpi";
import { fmtD, fmtDt } from "@/lib/util";
import { Card, CardHeader, DataTable, PageHeader, ReadinessBanner, StatusBadge } from "@/components/ui";
import { MilestoneTimeline } from "@/components/charts";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CtriActions } from "@/components/forms/ops";

export const dynamic = "force-dynamic";

export default async function TrialDetailPage({ params }: { params: { trialId: string } }) {
  const user = sessionUser();
  if (!user) redirect("/");
  const d = db();
  const trial = d.trials.find((t) => t.id === params.trialId);
  if (!trial) notFound();
  const isMain = trial.id === activeTrial().id;
  const readiness = trialReadiness(trial.id);
  const alerts = ethicsCtriAlerts(trial.id);
  const enrolled = d.enrollments.filter((e) => e.trialId === trial.id).length + trial.baseEnrolled;
  const canCtri = ["PI", "ADMIN"].includes(user.role);
  const submissions = d.ethicsSubmissions.filter((e) => e.trialId === trial.id);

  return (
    <>
      <Breadcrumbs />
      <PageHeader
        title={trial.code}
        sub={trial.title}
        actions={<><StatusBadge status={trial.status} /><StatusBadge status={readiness.state} /></>}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Trial metadata" sub={`Protocol ${trial.protocolVersion} · ${trial.phase}`} />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2">
            {[
              ["Intervention", trial.intervention],
              ["Target enrollment", `${enrolled} / ${trial.targetEnrollment} (live)`],
              ["Sites", d.sites.filter((s) => trial.siteIds.includes(s.id)).map((s) => s.name).join(" · ")],
              ["Consent version", trial.consentVersion],
              ["Start date", fmtD(trial.startDate)],
              ["Planned end", fmtD(trial.endDate)],
              ["Trial status", `${trial.status} (DEMO)`],
              ["Ethics", submissions.length ? `${submissions.filter((s) => s.status === "APPROVED").length} approved · ${submissions.filter((s) => s.status === "EXPIRED").length} expired` : "No submissions"],
              ["CTRI", trial.ctri.state === "REGISTERED" ? `REGISTERED (DEMO) — ${trial.ctri.ref}` : trial.ctri.state === "REF" ? `REF — ${trial.ctri.ref} (not registered)` : "DRAFT"],
              ["CTRI renewal due", trial.ctri.renewalDueAt ? fmtD(trial.ctri.renewalDueAt) : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{k}</dt>
                <dd className="mt-0.5 text-ink-soft">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card>
          <CardHeader title="Trial readiness" sub="enrollment gate at trial level" />
          <div className="space-y-3 p-4">
            <ReadinessBanner state={readiness.state} blockers={readiness.warnings} />
            <ul className="space-y-1.5 text-xs">
              {readiness.rows.map((r) => (
                <li key={r.label} className="flex items-center justify-between gap-2">
                  <span className={r.ok ? "text-ink-soft" : "font-medium text-danger"}>{r.ok ? "✓" : "✕"} {r.label}</span>
                  <span className="truncate text-[10px] text-ink-mute">{r.detail}</span>
                </li>
              ))}
            </ul>
            {alerts.total > 0 ? (
              <div className="rounded-md border border-warn-line bg-warn-bg p-2.5 text-[11px] text-warn">
                ▲ {alerts.total} active alert(s): {alerts.ctriAlerts.join(" ")}
                {alerts.ethics.map((e) => ` ${e.code} ${e.status}.`)}
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Sites" sub="site activation and enrollment scope" />
          <DataTable head={["Site", "Status", "City"]}>
            {d.sites.filter((s) => trial.siteIds.includes(s.id)).map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2.5 text-sm text-ink-soft">{s.name}</td>
                <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-2.5 text-xs text-ink-mute">{s.city}</td>
              </tr>
            ))}
          </DataTable>
        </Card>

        <Card>
          <CardHeader
            title="CTRI record"
            sub="DRAFT → REF → REGISTERED are distinct states. REF is not registration."
            right={<StatusBadge status={trial.ctri.state} />}
          />
          <div className="space-y-2 p-4 text-xs text-ink-soft">
            <p>REF / registration no.: <span className="font-mono">{trial.ctri.ref ?? "—"}</span></p>
            <p>Registered: {trial.ctri.registeredAt ? fmtDt(trial.ctri.registeredAt) : "—"} · Renewal due: {trial.ctri.renewalDueAt ? fmtD(trial.ctri.renewalDueAt) : "—"}</p>
            <p className="rounded-md border border-stone-200 bg-stone-50 p-2 text-[11px] text-ink-mute">
              External submission: <strong>MOCKED</strong> — this demo never communicates with CTRI/CDSCO. Production integration required.
            </p>
            {canCtri ? <CtriActions trialId={trial.id} state={trial.ctri.state} /> : (
              <p className="text-[11px] text-ink-mute">CTRI state transitions are restricted to PI / Admin.</p>
            )}
          </div>
        </Card>
      </div>

      {isMain ? (
        <Card className="mt-5">
          <CardHeader title="Regulatory timeline" sub="ethics + CTRI milestones for the demo trial" />
          <MilestoneTimeline milestones={[
            { label: "Ethics submitted (Site 1)", date: fmtD(d.ethicsSubmissions[0].submittedAt), done: true },
            { label: "CTRI registered (demo)", date: fmtD(trial.ctri.registeredAt), done: true },
            { label: "Ethics approved — Site 1", date: fmtD(d.ethicsSubmissions[0].approvedAt), done: true },
            { label: "Site 3 approval", date: "EXPIRED 16 Sep 2026", done: false, warn: true },
            { label: "CTRI renewal due", date: fmtD(trial.ctri.renewalDueAt), done: false, warn: true },
            { label: "Study end", date: fmtD(trial.endDate), done: false },
          ]} />
        </Card>
      ) : null}
    </>
  );
}
