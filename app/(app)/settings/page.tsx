import { redirect } from "next/navigation";
import { PERMS, sessionUser } from "@/lib/auth";
import { db, storeModeLabel } from "@/lib/store";
import { fmtDt } from "@/lib/util";
import { Card, CardHeader, DataTable, PageHeader, StatusBadge } from "@/components/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AdminActions } from "@/components/forms/ops";
import { AccessDenied } from "@/components/access";

export const dynamic = "force-dynamic";

const ROLES = ["ADMIN", "PI", "COORDINATOR", "MONITOR", "PV_OFFICER", "ETHICS_MEMBER", "LEADERSHIP"];

export default async function SettingsPage() {
  const user = sessionUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") {
    return <AccessDenied title="Admin only" message="Settings and demo data management are restricted to the Admin role." hint="Sign in as admin@demo.local (password demo1234)." />;
  }
  const d = db();

  return (
    <>
      <Breadcrumbs />
      <PageHeader title="Settings" sub="Admin area: demo users, demo data control, permission matrix and system overview." />

      <Card>
        <CardHeader title="Demo data control" sub="Essential for repeated SIH presentations" />
        <AdminActions />
        <p className="border-t border-stone-100 px-4 py-2.5 text-[11px] text-ink-mute">
          “Reset Demo Data” restores the original seeded state (24 enrolled, blocked AYU-0025, open SAE, 5 open queries, ethics warning).
          “Load Judge Scenario” resets first and confirms the controlled scenario artifacts exist.
        </p>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Demo users" sub="Local demo mode — simple shared password (demo1234). Production path: Supabase Auth." />
          <DataTable head={["Name", "Email", "Role", "Scope"]}>
            {d.users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2 text-sm font-medium text-ink">{u.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{u.email}</td>
                <td className="px-4 py-2"><StatusBadge status={u.role} /></td>
                <td className="px-4 py-2 text-[11px] text-ink-mute">{u.role === "MONITOR" ? "Assigned site(s) only" : u.role === "LEADERSHIP" ? "Aggregate only" : "Standard"}</td>
              </tr>
            ))}
          </DataTable>
        </Card>

        <Card>
          <CardHeader title="System overview" sub="Local demo mode — in-app synthetic database" />
          <div className="grid grid-cols-2 gap-3 p-4 text-sm">
            {[
              ["Trials", d.trials.length], ["Sites", d.sites.length], ["Participants", d.participants.length],
              ["Visits", d.visits.length], ["CRF observations", d.observations.length], ["Lab results", d.labResults.length],
              ["Safety events", d.safetyEvents.length], ["PV tasks", d.pvTasks.length],
              ["Queries", d.queries.length], ["Findings", d.findings.length],
              ["Ethics submissions", d.ethicsSubmissions.length], ["Audit entries", d.auditLogs.length],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{label}</p>
                <p className="text-lg font-semibold text-ink">{value}</p>
              </div>
            ))}
          </div>
          <p className="border-t border-stone-100 px-4 py-2.5 text-[11px] text-ink-mute">Database seeded: {fmtDt(d.meta.seededAt)}</p>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader title="Role permission matrix" sub="Menus are UX — authorization is enforced server-side on every request" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50">
                <th className="px-4 py-2 font-semibold uppercase tracking-wider text-ink-mute">Permission</th>
                {ROLES.map((r) => <th key={r} className="px-2 py-2 text-center font-semibold uppercase tracking-wider text-ink-mute">{r.slice(0, 4)}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {Object.entries(PERMS).map(([perm, roles]) => (
                <tr key={perm}>
                  <td className="px-4 py-1.5 font-mono text-[11px] text-ink-soft">{perm}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-2 py-1.5 text-center">
                      {roles.includes(r as never) ? <span className="text-ok" aria-label={`${r} allowed`}>●</span> : <span className="text-stone-300" aria-label={`${r} denied`}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-5">
        <CardHeader title="Mode & production path" sub="Honest technical boundaries" />
        <div className="space-y-2 p-4 text-xs leading-relaxed text-ink-soft">
          <p><strong>Current mode: LOCAL DEMO.</strong> Simulated authentication (shared demo password), in-app synthetic database with file persistence, application-level audit. Clearly labelled as simulated.</p>
          <p><strong>Production path (documented, not active here):</strong> Supabase Auth + Postgres with Row Level Security, UUID keys, unique constraint on (trial, subject_code), restrictive deletes, service-role key never exposed to the client. Reference schema + RLS policies: <code className="rounded bg-stone-100 px-1">supabase/schema.sql</code>.</p>
          <p><strong>Not claimed:</strong> GCP/regulatory certification, ABDM/CTRI/CDSCO integration, clinical validation, tamper-proof audit storage, validated CDISC compliance.</p>
        </div>
      </Card>
    </>
  );
}
