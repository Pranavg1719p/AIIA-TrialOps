import Link from "next/link";
import { redirect } from "next/navigation";
import { sessionUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { DataTable, PageHeader, StatusBadge } from "@/components/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { fmtD } from "@/lib/util";

export const dynamic = "force-dynamic";

export default async function TrialsPage() {
  const user = sessionUser();
  if (!user) redirect("/");
  const d = db();

  return (
    <>
      <Breadcrumbs />
      <PageHeader title="Trials" sub="Synthetic demo portfolio — open AIIA-AYU-026-DEMO for the full readiness view." />
      <div className="rounded-lg border border-stone-200 bg-white shadow-card">
        <DataTable head={["Trial", "Protocol", "Sites", "Enrollment", "Status", "Ethics", "CTRI", ""]}>
          {d.trials.map((t) => {
            const enrolled = d.enrollments.filter((e) => e.trialId === t.id).length + t.baseEnrolled;
            const ethicsOk = d.ethicsSubmissions.some((e) => e.trialId === t.id && e.status === "APPROVED");
            const ethicsBad = d.ethicsSubmissions.some((e) => e.trialId === t.id && e.status === "EXPIRED");
            return (
              <tr key={t.id} className="hover:bg-stone-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{t.code}</p>
                  <p className="max-w-[320px] truncate text-xs text-ink-mute">{t.title}</p>
                </td>
                <td className="px-4 py-3 text-xs text-ink-soft">{t.protocolVersion}</td>
                <td className="px-4 py-3 text-xs text-ink-soft">{t.siteIds.length}</td>
                <td className="px-4 py-3 text-xs font-medium text-ink-soft">{enrolled} / {t.targetEnrollment}</td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3"><StatusBadge status={ethicsBad ? "EXPIRED" : ethicsOk ? "APPROVED" : "PENDING"} /></td>
                <td className="px-4 py-3"><StatusBadge status={t.ctri.state} /></td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/trials/${t.id}`} className="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-tint">Open →</Link>
                </td>
              </tr>
            );
          })}
        </DataTable>
      </div>
      <p className="mt-3 text-[11px] text-ink-mute">
        Note: CTRI states DRAFT → REF → REGISTERED are tracked separately. A REF number is never presented as final registration.
        Enrollment counts are computed live ({fmtD(new Date().toISOString())}).
      </p>
    </>
  );
}
