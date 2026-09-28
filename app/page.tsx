import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { sessionUser } from "@/lib/auth";
import { ensureLoaded } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await ensureLoaded();
  if (sessionUser()) redirect("/overview");

  return (
    <main id="main" className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col px-4 py-8">
      <div className="flex flex-1 flex-col items-center justify-center gap-10 py-6 lg:flex-row lg:items-stretch lg:gap-14">
        {/* brand / story panel */}
        <div className="flex max-w-lg flex-col justify-center">
          <div className="flex items-center gap-3">
            <span aria-hidden className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-xl font-bold text-white">आ</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-ink">AIIA TrialOps</h1>
              <p className="text-sm text-ink-soft">Clinical Trial Operations Workspace</p>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-brand">Synthetic clinical trial operations workspace</p>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
            One governed trial record. One connected workflow. AIIA TrialOps connects trial operations,
            participant workflow, safety, ethics/regulatory tracking, quality, audit and interoperable
            exports — so status is visible and actions are traceable.
          </p>
          <ul className="mt-5 grid gap-2 text-sm text-ink-soft sm:grid-cols-2">
            {[
              "Screening → consent → enrollment gate",
              "Visits, CRFs and labs with validation",
              "AE/SAE → PV queue, automatically",
              "Monitoring queries with lifecycle",
              "Ethics & CTRI expiry tracking",
              "Audit + FHIR / CDISC-style exports",
            ].map((f) => (
              <li key={f} className="flex items-start gap-2 rounded-md border border-stone-200 bg-white px-2.5 py-2">
                <span aria-hidden className="mt-0.5 text-[10px] text-ok">●</span>{f}
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-lg border border-stone-200 bg-white p-3 text-[11px] leading-relaxed text-ink-mute">
            <strong className="text-ink-soft">Demo environment.</strong> All data is synthetic and coded (no names,
            phone numbers, addresses or ABHA IDs). This is a student MVP for Smart India Hackathon 2026 — not a
            production CTMS, not a clinical decision system, and not an official CTRI/CDSCO/ABDM portal.
          </p>
        </div>

        {/* login panel */}
        <div className="flex w-full max-w-md flex-col justify-center">
          <LoginForm />
        </div>
      </div>

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-4 text-[11px] text-ink-mute">
        <span>Problem SIH26046 · MedTech / BioTech / HealthTech · Team prototype build</span>
        <Link href="/about" className="font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
          About AIIA TrialOps →
        </Link>
      </footer>
    </main>
  );
}
