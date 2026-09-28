import Link from "next/link";
import { redirect } from "next/navigation";
import { can, sessionUser, visibleParticipants } from "@/lib/auth";
import { db } from "@/lib/store";
import { safetyTaskCounts } from "@/lib/kpi";
import { fmtD, fmtDt, isPast } from "@/lib/util";
import { Card, CardHeader, DataTable, EmptyState, PageHeader, StatusBadge, cx } from "@/components/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PvActions, SafetyEventForm } from "@/components/forms/safety";
import { AccessDenied } from "@/components/access";

export const dynamic = "force-dynamic";

const QUEUE_TABS: [string, string, (s: { status: string }) => boolean][] = [
  ["NEW_CASES", "New cases", (s) => s.status === "IDENTIFIED" || s.status === "PI_REVIEW_PENDING"],
  ["COMPLETENESS", "Completeness review", (s) => s.status === "IDENTIFIED"],
  ["FOLLOW_UP", "Follow-up due", (s) => s.status === "FOLLOW_UP"],
  ["IN_REVIEW", "In review", (s) => s.status === "PV_IN_REVIEW"],
  ["CLOSED", "Closed", (s) => s.status === "CLOSED"],
  ["ALL", "All cases", () => true],
];

export default async function SafetyPage({ searchParams }: { searchParams: { tab?: string; case?: string; filter?: string } }) {
  const user = sessionUser();
  if (!user) redirect("/");
  if (!["ADMIN", "PI", "COORDINATOR", "MONITOR", "PV_OFFICER"].includes(user.role)) {
    return <AccessDenied message="Safety case data is restricted to operations, safety and monitoring roles." hint="Leadership sees aggregate safety KPIs on the Overview page." />;
  }
  const d = db();
  const visible = new Set(visibleParticipants(user).map((p) => p.id));
  const events = d.safetyEvents.filter((s) => visible.has(s.participantId));
  const tabKey = searchParams.tab ?? "NEW_CASES";
  const tab = QUEUE_TABS.find(([k]) => k === tabKey) ?? QUEUE_TABS[0];
  const list = events.filter(tab[2]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selected = searchParams.case ? events.find((e) => e.id === searchParams.case) : undefined;
  const st = safetyTaskCounts();
  const canReport = can(user.role, "safety.create");
  const enrolled = d.participants
    .filter((p) => visible.has(p.id) && p.status === "ENROLLED")
    .map((p) => ({ id: p.id, code: p.code }));

  return (
    <>
      <Breadcrumbs />
      <PageHeader
        title="Safety — AE / SAE & Pharmacovigilance"
        sub="Event identified → initial record → PI review → priority task → follow-up → closure. All data fictional; humans make every clinical determination."
        actions={
          <div className="flex gap-1.5 text-[11px] text-ink-mute">
            <span className="rounded border border-stone-200 bg-white px-2 py-1">{st.pending} completeness</span>
            <span className="rounded border border-danger-line bg-danger-bg px-2 py-1 text-danger">{st.followUp} follow-up due</span>
            <span className="rounded border border-ok-line bg-ok-bg px-2 py-1 text-ok">{st.done} closed</span>
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5" role="tablist" aria-label="PV queue">
        {QUEUE_TABS.map(([k, label]) => {
          const count = events.filter(QUEUE_TABS.find(([kk]) => kk === k)![2]).length;
          return (
            <Link key={k} href={`/safety?tab=${k}`} role="tab" aria-selected={tabKey === k}
              className={cx("rounded-md px-3 py-1.5 text-xs font-semibold", tabKey === k ? "bg-brand text-white" : "border border-stone-200 bg-white text-ink-soft hover:bg-stone-50")}>
              {label} <span className={cx("ml-1 rounded px-1", tabKey === k ? "bg-white/20" : "bg-stone-100")}>{count}</span>
            </Link>
          );
        })}
      </div>

      {canReport ? (
        <Card className="mb-5">
          <details open={searchParams.filter === "new"}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand">+ Report adverse event (AE / SAE)</summary>
            <p className="px-4 pb-1 text-[11px] text-ink-mute">A serious event automatically creates a PV follow-up task, updates the safety KPI and writes an audit entry.</p>
            <SafetyEventForm participants={enrolled} />
          </details>
        </Card>
      ) : null}

      {selected ? (
        <Card className="mb-5 border-brand/30">
          <CardHeader title={`Case ${selected.caseNo}`} sub={`${d.participants.find((p) => p.id === selected.participantId)?.code} · reported ${fmtDt(selected.createdAt)} by ${selected.createdBy}`} right={<StatusBadge status={selected.status} />} />
          <div className="grid gap-4 p-4 text-sm lg:grid-cols-2">
            <dl className="space-y-2">
              {[
                ["Event term", selected.term], ["Onset", fmtD(selected.onsetAt)], ["Awareness", fmtD(selected.awarenessAt)],
                ["Seriousness", selected.seriousness.replace("_", " ") + (selected.seriousnessCriteria.length ? ` (${selected.seriousnessCriteria.join(", ")})` : "")],
                ["Severity", selected.severity], ["Suspected product", selected.suspectedProduct],
                ["Batch", selected.batch], ["Outcome", selected.outcome || "Ongoing — not yet recorded"],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{k}</dt><dd className="text-ink-soft">{v}</dd></div>
              ))}
            </dl>
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">Narrative</p>
                <p className="mt-1 rounded-md border border-stone-200 bg-stone-50 p-2.5 text-xs text-ink-soft">{selected.narrative}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">Case log</p>
                <ol className="mt-1 space-y-1.5">
                  {selected.log.map((l, i) => (
                    <li key={i} className="rounded-md border border-stone-100 bg-white px-2.5 py-1.5 text-xs text-ink-soft">
                      <span className="font-medium text-ink">{l.by}</span> · {fmtDt(l.at)}<br />{l.text}
                    </li>
                  ))}
                </ol>
              </div>
              <PvActions caseId={selected.id} status={selected.status} outcome={selected.outcome}
                canPiReview={can(user.role, "safety.piReview")} canPv={can(user.role, "pv.act")} />
              <p className="text-[11px] text-ink-mute">AI never determines causality, seriousness, diagnosis or regulatory applicability — reviewers do.</p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="rounded-lg border border-stone-200 bg-white shadow-card">
        {list.length === 0 ? (
          <EmptyState title="No safety cases require follow-up." hint="This queue is empty — new AE/SAE records appear here instantly." />
        ) : (
          <DataTable head={["Case", "Subject", "Event", "Severity", "Due", "Owner", "Status", ""]} caption={`${list.length} case(s) in this queue view.`}>
            {list.map((s) => {
              const task = d.pvTasks.find((t) => t.caseId === s.id && t.status !== "DONE");
              const overdue = task && isPast(task.dueAt) && s.status !== "CLOSED";
              return (
                <tr key={s.id} className={overdue ? "bg-danger-bg/40" : "hover:bg-stone-50"}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold">{s.caseNo}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{d.participants.find((p) => p.id === s.participantId)?.code}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">{s.term}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={s.severity} /></td>
                  <td className="px-4 py-2.5 text-xs">{task ? <span className={overdue ? "font-semibold text-danger" : ""}>{fmtD(task.dueAt)}{overdue ? " (overdue)" : ""}</span> : "—"}</td>
                  <td className="px-4 py-2.5 text-[11px] text-ink-mute">{task?.owner ?? "—"}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={s.seriousness === "SERIOUS" && s.status !== "CLOSED" ? "SERIOUS" : s.status} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end">
                      <Link href={`/safety?tab=${tabKey}&case=${s.id}`} className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-tint">Review →</Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>
    </>
  );
}
