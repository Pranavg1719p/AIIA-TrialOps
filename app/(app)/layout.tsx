import { redirect } from "next/navigation";
import { navFor, sessionUser } from "@/lib/auth";
import { db, ensureLoaded } from "@/lib/store";
import { fmtDt, ROLE_LABEL } from "@/lib/util";
import { ToastProvider } from "@/components/toast";
import { Topbar } from "@/components/topbar";
import { Sidebar } from "@/components/sidebar";
import { JudgePanel } from "@/components/judge-panel";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ensureLoaded();
  const user = sessionUser();
  if (!user) redirect("/");
  const d = db();
  const trial = d.trials[0];
  const notifications = d.notifications
    .filter((n) => n.roles.includes(user.role))
    .slice(0, 12)
    .map((n) => ({
      id: n.id, title: n.title, body: n.body, link: n.link,
      at: fmtDt(n.at), read: n.readBy.includes(user.role),
    }));
  const scopeLabel =
    user.role === "MONITOR"
      ? d.sites.filter((s) => user.siteScope.includes(s.id)).map((s) => s.code).join(", ")
      : user.role === "LEADERSHIP"
        ? "Aggregate only"
        : "All sites (assigned)";

  return (
    <ToastProvider>
      <div className="flex min-h-[calc(100vh-2rem)] flex-col">
        <Topbar
          user={{ name: user.name, role: ROLE_LABEL[user.role], email: user.email }}
          trialCode={trial.code}
          scopeLabel={scopeLabel}
          notifications={notifications}
        />
        <div className="flex flex-1 flex-col lg:flex-row">
          <Sidebar items={navFor(user.role)} />
          <main id="main" className="min-w-0 flex-1 px-4 py-6 lg:px-8">
            {children}
            <footer className="mt-12 border-t border-stone-200 pt-3 text-[11px] leading-relaxed text-ink-mute">
              <p>
                <strong className="text-ink-soft">AIIA TrialOps</strong> — synthetic demonstration only, not for clinical use.
                Not a production CTMS; not a clinical decision system; not an official CTRI/CDSCO/ABDM portal.
                Audit history is application-level. Exports are sample mapping demonstrations.
              </p>
            </footer>
          </main>
        </div>
      </div>
      <JudgePanel canAct={true} />
    </ToastProvider>
  );
}
