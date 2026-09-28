import Link from "next/link";
import { redirect } from "next/navigation";
import { can, sessionUser, visibleParticipants } from "@/lib/auth";
import { db } from "@/lib/store";
import { fmtD, isPast } from "@/lib/util";
import { Card, DataTable, EmptyState, PageHeader, StatusBadge, cx } from "@/components/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionButton } from "@/components/action";
import { VisitCreate } from "@/components/forms/clinical";
import { AccessDenied } from "@/components/access";

export const dynamic = "force-dynamic";

const FILTERS: [string, string][] = [
  ["ALL", "All"], ["SCHEDULED", "Scheduled"], ["OVERDUE", "Overdue"], ["COMPLETED", "Completed"],
];

export default async function VisitsPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = sessionUser();
  if (!user) redirect("/");
  if (user.role === "PV_OFFICER" || user.role === "LEADERSHIP" || user.role === "ETHICS_MEMBER") {
    return <AccessDenied message="The visits workspace is limited to site operations and monitoring roles." />;
  }
  const d = db();
  const visible = new Set(visibleParticipants(user).map((p) => p.id));
  const filter = searchParams.status ?? "ALL";
  const visits = d.visits
    .filter((v) => visible.has(v.participantId))
    .filter((v) => {
      if (filter === "ALL") return true;
      if (filter === "OVERDUE") return v.status === "SCHEDULED" && isPast(v.dueAt);
      return v.status === filter;
    })
    .sort((a, b) => (filter === "COMPLETED" ? b.dueAt.localeCompare(a.dueAt) : a.dueAt.localeCompare(b.dueAt)))
    .slice(0, 80);

  const participants = d.participants.filter((p) => visible.has(p.id) && p.status === "ENROLLED").map((p) => ({ id: p.id, code: p.code }));
  const isCoordinator = can(user.role, "visit.write");
  const isMonitor = user.role === "MONITOR";

  return (
    <>
      <Breadcrumbs />
      <PageHeader
        title="Visits"
        sub="Expected visits across your accessible site(s). Completing a visit updates completion KPIs, the missing-data assistant and the audit trail."
        actions={
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map(([key, label]) => (
              <Link key={key} href={`/visits?status=${key}`}
                className={cx("rounded-full px-3 py-1.5 text-xs font-semibold", filter === key ? "bg-brand text-white" : "border border-stone-300 bg-white text-ink-soft hover:bg-stone-50")}>
                {label}
              </Link>
            ))}
          </div>
        }
      />

      {isCoordinator ? (
        <Card className="mb-5">
          <details>
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand">+ Schedule a visit (Coordinator)</summary>
            <VisitCreate participants={participants} />
          </details>
        </Card>
      ) : null}

      <div className="rounded-lg border border-stone-200 bg-white shadow-card">
        {visits.length === 0 ? (
          <EmptyState title="No visits match this filter." />
        ) : (
          <DataTable head={["Participant", "Visit", "Due", "Status", "Completed", "By", "Actions"]} caption={`${visits.length} visit record(s) — live view.`}>
            {visits.map((v) => {
              const p = d.participants.find((x) => x.id === v.participantId)!;
              const site = d.sites.find((s) => s.id === p.siteId)!;
              const overdue = v.status === "SCHEDULED" && isPast(v.dueAt);
              const hasCrf = d.observations.some((o) => o.visitId === v.id);
              return (
                <tr key={v.id} className={overdue ? "bg-danger-bg/40" : "hover:bg-stone-50"}>
                  <td className="px-4 py-2.5">
                    <Link href={`/participants/${p.id}?tab=visits`} className="font-mono text-sm font-semibold text-brand hover:underline">{p.code}</Link>
                    <span className="ml-1.5 text-[10px] text-ink-mute">{site.code}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-ink-soft">{v.type.replace("_", " ")}</td>
                  <td className="px-4 py-2.5 text-xs">{fmtD(v.dueAt)}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={overdue ? "OVERDUE" : v.status} /></td>
                  <td className="px-4 py-2.5 text-xs">{v.completedAt ? fmtD(v.completedAt) : "—"}</td>
                  <td className="px-4 py-2.5 text-[11px] text-ink-mute">{v.completedBy ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      {isCoordinator && v.status === "SCHEDULED" ? (
                        <>
                          <ActionButton url="/api/visits" body={{ action: "complete", id: v.id }} label="Complete visit" small
                            success="Visit completed." disabledReason="A completed CRF is required before completing a visit." />
                          <Link href={`/participants/${p.id}?tab=visits`} className="rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-ink hover:bg-stone-50">Add CRF{hasCrf ? " ✓" : ""}</Link>
                        </>
                      ) : v.status === "COMPLETED" ? (
                        <Link href={`/participants/${p.id}?tab=crf`} className="text-xs font-semibold text-brand hover:underline">View CRF →</Link>
                      ) : (
                        <span className="text-[11px] text-ink-mute">{isMonitor ? "Read-only (monitor)" : "—"}</span>
                      )}
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
