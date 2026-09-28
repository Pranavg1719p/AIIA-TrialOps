import { redirect } from "next/navigation";
import { can, sessionUser } from "@/lib/auth";
import { db } from "@/lib/store";
import {
  activeTrial, computeKpis, enrollmentBySite, ethicsCtriAlerts, queryStatusCounts, safetyTaskCounts, visitCompletion,
} from "@/lib/kpi";
import { cdiscExceptions } from "@/lib/cdisc";
import { fhirMappingNotes } from "@/lib/fhir";
import { fmtD, fmtDt } from "@/lib/util";
import { Card, CardHeader, DataTable, PageHeader, StatusBadge } from "@/components/ui";
import { BarChartH } from "@/components/charts";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ExportButton } from "@/components/forms/ops";
import { AsOf } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const user = sessionUser();
  if (!user) redirect("/");
  if (!can(user.role, "report.view")) redirect("/overview");
  const d = db();
  const trial = activeTrial();
  const k = computeKpis(trial.id);
  const vc = visitCompletion(trial.id);
  const qs = queryStatusCounts(trial.id);
  const st = safetyTaskCounts();
  const alerts = ethicsCtriAlerts(trial.id);
  const aggregateOnly = user.role === "LEADERSHIP";
  const canExport = can(user.role, "export.create");
  const exceptions = cdiscExceptions();
  const notes = fhirMappingNotes();
  const generatedAt = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

  return (
    <>
      <Breadcrumbs />
      <PageHeader
        title="Reports & Exports"
        sub={<>All reports are generated live from application data at view time · <AsOf prefix="Rendered" />{aggregateOnly ? " · Leadership view: aggregate tables only" : ""}</>}
      />

      <Card id="trial-summary">
        <CardHeader title="Trial Summary" sub={`Generated ${generatedAt} IST · ${trial.code} · synthetic demo data`} />
        <div className="space-y-2 p-4 text-sm leading-relaxed text-ink-soft">
          <p>
            Trial <strong>{trial.code}</strong> ({trial.title}) is in <StatusBadge status={trial.status} /> status under protocol{" "}
            {trial.protocolVersion}, investigating {trial.intervention}. Enrollment stands at{" "}
            <strong>{k.enrolled} of {k.target}</strong> participants ({Math.round((k.enrolled / k.target) * 100)}% of target) across{" "}
            {trial.siteIds.length} sites. Ethics approval is <strong>APPROVED</strong> for {d.ethicsSubmissions.filter((e) => e.status === "APPROVED").length} site(s) with{" "}
            {alerts.ethics.length} lapsed approval(s); CTRI status is <strong>{trial.ctri.state} (DEMO)</strong>{trial.ctri.ref ? ` (${trial.ctri.ref})` : ""}.
          </p>
          <p>
            {vc.completed} of {vc.dueTotal} expected visits are completed ({vc.pct}%). {qs.open} queries are open and {qs.responded} responded
            ({qs.resolved} resolved to date). The PV queue holds {k.safetyFollowUp} open task(s). {k.missingData} expected form(s)/visit(s) are
            flagged incomplete by the completeness assistant.
          </p>
          <p className="text-[11px] text-ink-mute">Figures recompute from the demo database on every load — no static screenshots.</p>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card id="enrollment">
          <CardHeader title="Enrollment Report" sub={`${k.enrolled} / ${k.target} enrolled (live)`} />
          <DataTable head={["Site", "Enrolled"]}>
            {enrollmentBySite(trial.id).map((x) => (
              <tr key={x.site.id}><td className="px-4 py-2 text-sm text-ink-soft">{x.site.name}</td><td className="px-4 py-2 text-sm font-semibold">{x.count}</td></tr>
            ))}
            <tr className="bg-stone-50"><td className="px-4 py-2 text-sm font-semibold">Total</td><td className="px-4 py-2 text-sm font-semibold">{k.enrolled}</td></tr>
          </DataTable>
          <BarChartH data={enrollmentBySite(trial.id).map((x) => ({ label: x.site.code, value: x.count }))} />
        </Card>

        <Card id="safety">
          <CardHeader title="Safety Report" sub="Aggregate view · humans own all clinical determinations" />
          <DataTable head={["Queue", "Cases"]}>
            <tr><td className="px-4 py-2 text-sm text-ink-soft">New cases (awaiting review)</td><td className="px-4 py-2 text-sm font-semibold">{d.safetyEvents.filter((s) => s.status === "IDENTIFIED" || s.status === "PI_REVIEW_PENDING").length}</td></tr>
            <tr><td className="px-4 py-2 text-sm text-ink-soft">Follow-up due</td><td className="px-4 py-2 text-sm font-semibold">{st.followUp}</td></tr>
            <tr><td className="px-4 py-2 text-sm text-ink-soft">In review</td><td className="px-4 py-2 text-sm font-semibold">{st.inReview}</td></tr>
            <tr><td className="px-4 py-2 text-sm text-ink-soft">Closed</td><td className="px-4 py-2 text-sm font-semibold">{st.done}</td></tr>
          </DataTable>
          {!aggregateOnly ? (
            <DataTable head={["Case", "Subject", "Seriousness", "Status"]}>
              {d.safetyEvents.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-mono text-xs">{s.caseNo}</td>
                  <td className="px-4 py-2 font-mono text-xs">{d.participants.find((p) => p.id === s.participantId)?.code}</td>
                  <td className="px-4 py-2"><StatusBadge status={s.seriousness} /></td>
                  <td className="px-4 py-2"><StatusBadge status={s.status} /></td>
                </tr>
              ))}
            </DataTable>
          ) : null}
        </Card>

        <Card id="queries">
          <CardHeader title="Query Report" sub="Open → responded → resolved lifecycle" />
          <DataTable head={["State", "Count"]}>
            <tr><td className="px-4 py-2 text-sm text-ink-soft">Open</td><td className="px-4 py-2 text-sm font-semibold">{qs.open}</td></tr>
            <tr><td className="px-4 py-2 text-sm text-ink-soft">Responded (awaiting resolution)</td><td className="px-4 py-2 text-sm font-semibold">{qs.responded}</td></tr>
            <tr><td className="px-4 py-2 text-sm text-ink-soft">Resolved</td><td className="px-4 py-2 text-sm font-semibold">{qs.resolved}</td></tr>
          </DataTable>
        </Card>

        <Card id="audit">
          <CardHeader title="Audit Report" sub="Most recent 10 entries — application-level audit history" />
          <DataTable head={["When", "Actor", "Record", "Transition"]}>
            {d.auditLogs.slice(0, 10).map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-2 text-[11px] text-ink-mute">{fmtDt(a.at)}</td>
                <td className="px-4 py-2 text-xs">{a.actor} <span className="text-ink-mute">({a.role.replace(/_/g, " ")})</span></td>
                <td className="px-4 py-2 text-xs">{a.entity} <span className="font-mono text-[10px]">{a.entityId}</span></td>
                <td className="px-4 py-2 text-xs font-medium">{a.action}{a.from || a.to ? `: ${a.from ?? "—"} → ${a.to ?? "—"}` : ""}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>

      <Card className="mt-5" id="interop">
        <CardHeader title="Interoperability — downloads" sub="Generated from live data. External transmission: MOCKED — production integration required." />
        {canExport ? (
          <div className="grid gap-2 p-4 lg:grid-cols-2">
            <ExportButton url="/api/exports/fhir" filename="aiia-demo-fhir-bundle.json" label="FHIR R4 Bundle (JSON)"
              sub={`Bundle · collection · ${d.enrollments.filter((e) => e.trialId === trial.id).length} synthetic patients + observations/encounters/consents`} />
            <ExportButton url="/api/exports/cdisc?dataset=DM" filename="DM-like.csv" label="DM-like.csv" sub="Demographics-like dataset (coded subjects)" />
            <ExportButton url="/api/exports/cdisc?dataset=VS" filename="VS-like.csv" label="VS-like.csv" sub="Vital-signs/lab-like dataset" />
            <ExportButton url="/api/exports/cdisc?dataset=AE" filename="AE-like.csv" label="AE-like.csv" sub="Adverse-event-like dataset" />
            <ExportButton url="/api/exports/cdisc?dataset=mapping" filename="mapping_dictionary.csv" label="mapping_dictionary.csv" sub="Source → target column mapping notes" />
          </div>
        ) : (
          <p className="p-4 text-xs text-ink-mute">Exports are restricted to Coordinator / PI / Admin roles.</p>
        )}
        <div className="border-t border-stone-100 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">FHIR mapping notes</p>
          <DataTable head={["Resource", "Source", "Mapping note"]}>
            {notes.map((n, i) => (
              <tr key={i}><td className="px-4 py-2 text-xs font-semibold">{n.resource}</td><td className="px-4 py-2 font-mono text-[11px]">{n.source}</td><td className="px-4 py-2 text-xs text-ink-soft">{n.note}</td></tr>
            ))}
          </DataTable>
        </div>
        <div className="border-t border-stone-100 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Validation exceptions ({exceptions.length})</p>
          <ul className="mt-2 space-y-1.5">
            {exceptions.map((e, i) => (
              <li key={i} className="rounded-md border border-warn-line bg-warn-bg px-2.5 py-1.5 text-xs text-warn">▲ {e.dataset}: {e.detail}</li>
            ))}
          </ul>
          <p className="mt-3 rounded-md border border-stone-200 bg-stone-50 p-2.5 text-[11px] font-semibold text-ink-soft">
            Sample mapping demonstration — not validated SDTM/ADaM/Define-XML. Source values are preserved; blanks are preserved as blanks.
          </p>
        </div>
        <div className="border-t border-stone-100 p-4 text-[11px] text-ink-mute">
          Milestone context: first participant in {fmtD(d.enrollments[0]?.enrolledAt)} · CTRI registered {fmtD(trial.ctri.registeredAt)} · planned end {fmtD(trial.endDate)}.
        </div>
      </Card>
    </>
  );
}
