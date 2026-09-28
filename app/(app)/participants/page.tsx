import Link from "next/link";
import { redirect } from "next/navigation";
import { can, participantVisible, sessionUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { isPast } from "@/lib/util";
import { Card, DataTable, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { NewParticipantForm } from "@/components/forms/participant";
import { AccessDenied } from "@/components/access";

export const dynamic = "force-dynamic";

const FILTERS: [string, string][] = [
  ["ALL", "All"],
  ["SCREENING", "Screening"],
  ["SCREENED", "Screened (gated)"],
  ["ENROLLED", "Enrolled"],
];

export default async function ParticipantsPage({ searchParams }: { searchParams: { status?: string } }) {
  const user = sessionUser();
  if (!user) redirect("/");
  const d = db();

  if (!can(user.role, "participant.read")) {
    return <AccessDenied message="Leadership accounts see aggregate KPIs only — participant-level clinical data is not accessible." hint="Sign in as Coordinator/PI/Monitor to work with participant records." />;
  }

  const filter = searchParams.status ?? "ALL";
  const sites = d.sites;
  const rows = d.participants
    .filter((p) => p.trialId === "trial-026" || ["PI", "COORDINATOR", "MONITOR", "ADMIN"].includes(user.role))
    .filter((p) => participantVisible(user, p))
    .filter((p) => filter === "ALL" || p.status === filter)
    .sort((a, b) => a.code.localeCompare(b.code));

  const siteOptions = sites.filter((s) => (user.role === "MONITOR" ? user.siteScope.includes(s.id) : true));

  return (
    <>
      <Breadcrumbs />
      <PageHeader
        title="Participants"
        sub="Synthetic coded identities only (AYU-####) — no names, contacts or ABHA numbers are stored."
        actions={
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Participant status filter">
            {FILTERS.map(([key, label]) => (
              <Link key={key} href={`/participants?status=${key}`} aria-current={filter === key ? "true" : undefined}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === key ? "bg-brand text-white" : "border border-stone-300 bg-white text-ink-soft hover:bg-stone-50"}`}>
                {label}
              </Link>
            ))}
          </div>
        }
      />

      {user.role === "COORDINATOR" ? (
        <Card className="mb-5">
          {filter === "ALL" || filter === "SCREENING" ? (
            <>
              <details>
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand">+ Add participant to screening (Coordinator)</summary>
                <NewParticipantForm sites={siteOptions} />
              </details>
            </>
          ) : null}
        </Card>
      ) : null}

      <div className="rounded-lg border border-stone-200 bg-white shadow-card">
        {rows.length === 0 ? (
          <EmptyState title="No participants match this filter." hint="Try the “All” filter or create a screening record." />
        ) : (
          <DataTable head={["Subject code", "Site", "Screening", "Consent", "Enrollment", "Next visit", "Safety", "Queries", "Status", ""]} caption={`Showing ${rows.length} record(s) — live from the demo database.`}>
            {rows.map((p) => {
              const site = sites.find((s) => s.id === p.siteId)!;
              const scr = d.screenings.find((s) => s.participantId === p.id);
              const consent = d.consents.filter((c) => c.participantId === p.id).slice(-1)[0];
              const enrolled = d.enrollments.find((e) => e.participantId === p.id);
              const nextVisit = d.visits
                .filter((v) => v.participantId === p.id && v.status === "SCHEDULED")
                .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
              const openSafety = d.safetyEvents.filter((s) => s.participantId === p.id && s.status !== "CLOSED").length;
              const openQueries = d.queries.filter((q) => q.participantId === p.id && q.status !== "RESOLVED").length;
              const scrDone = scr?.items.every((i) => i.done) && !!scr?.piReviewedAt;
              const nextOverdue = nextVisit && isPast(nextVisit.dueAt);
              return (
                <tr key={p.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5 font-mono text-sm font-semibold text-ink">{p.code}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">{site.code}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={scrDone ? "COMPLETED" : p.status === "SCREENING" ? "IN_REVIEW" : "COMPLETED"} /></td>
                  <td className="px-4 py-2.5"><StatusBadge status={consent?.status ?? "PENDING"} /></td>
                  <td className="px-4 py-2.5 text-xs text-ink-soft">{enrolled ? enrolled.enrolledAt.slice(0, 10) : "—"}</td>
                  <td className="px-4 py-2.5 text-xs">
                    {nextVisit ? (
                      <span className={nextOverdue ? "font-semibold text-danger" : "text-ink-soft"}>
                        {nextVisit.type.replace("_", " ")} · {nextVisit.dueAt.slice(0, 10)}{nextOverdue ? " (overdue)" : ""}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2.5">{openSafety > 0 ? <StatusBadge status="OPEN" /> : <span className="text-xs text-ink-mute">0</span>}</td>
                  <td className="px-4 py-2.5">{openQueries > 0 ? <StatusBadge status="OPEN" /> : <span className="text-xs text-ink-mute">0</span>}</td>
                  <td className="px-4 py-2.5"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/participants/${p.id}`} className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-tint">Open →</Link>
                  </td>
                </tr>
              );
            })}
          </DataTable>
        )}
      </div>
      {user.role === "MONITOR" ? (
        <p className="mt-3 text-[11px] text-ink-mute">Monitor scope: you see only your assigned site(s). Source records are read-only for monitors.</p>
      ) : null}
    </>
  );
}
