import Link from "next/link";

export const metadata = { title: "About — AIIA TrialOps" };

const CHAIN = ["Trial Operations", "Participant Workflow", "Safety", "Ethics / Regulatory Tracking", "Quality", "Audit", "Interoperability"];

export default function AboutPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link href="/" className="text-xs font-medium text-brand hover:underline">← Back to sign in</Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-ink">
        Making Ayurveda Trials Visible, Traceable and Interoperable.
      </h1>

      <section className="mt-6 space-y-3 text-[15px] leading-relaxed text-ink-soft">
        <p>Today, Ayurveda clinical trials often run on disconnected trackers, spreadsheets and paper files:</p>
        <div className="rounded-lg border border-danger-line bg-danger-bg p-4 text-sm text-danger">
          Disconnected trackers → late visibility → compliance and safety risk.
        </div>
        <p>
          A site coordinator learns about a missed visit weeks later. A monitor finds a consent discrepancy on
          paper months in. An SAE lives in a WhatsApp message before it reaches a follow-up queue. Ethics renewals
          lapse unnoticed. And at the end, data cannot be reused because it was never captured in a governed,
          interoperable form.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-ink">AIIA TrialOps connects the whole chain</h2>
        <p className="mt-1 text-sm text-ink-soft">Not another dashboard — one governed record with one connected workflow.</p>
        <ol className="mt-4 flex flex-wrap items-center gap-1.5">
          {CHAIN.map((c, i) => (
            <li key={c} className="flex items-center gap-1.5">
              <span className="rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink">{c}</span>
              {i < CHAIN.length - 1 ? <span aria-hidden className="text-stone-400">→</span> : null}
            </li>
          ))}
        </ol>
        <ul className="mt-4 space-y-2 text-sm text-ink-soft">
          <li><strong className="text-ink">Make status actionable.</strong> Enrollment gates, PV queues and query lifecycles are computed from the same records the team writes to.</li>
          <li><strong className="text-ink">Make safety visible.</strong> An SAE instantly creates a PV follow-up task, updates KPIs and writes an audit entry.</li>
          <li><strong className="text-ink">Make data reusable.</strong> FHIR R4 bundles and CDISC-style CSV exports are generated from live data with mapping notes and honest exceptions.</li>
        </ul>
      </section>

      <section className="mt-8 rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-ink-mute">Boundaries (read this part)</h2>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-relaxed text-ink-soft">
          <li>Synthetic demonstration only — all participants are coded identities (AYU-####) with no names, contacts, ABHA IDs or real records.</li>
          <li>Not a production CTMS, not a clinical decision system, and not an official CTRI/CDSCO/ABDM portal.</li>
          <li>AI features are rules-based process checks and aggregate summaries only. They never decide eligibility, diagnosis, causality, seriousness, treatment, consent validity or regulatory applicability — humans do.</li>
          <li>Audit history is application-level; it is not claimed to be WORM or tamper-proof.</li>
          <li>Exports are sample mapping demonstrations, not validated SDTM/ADaM/Define-XML. No external submissions occur — CTRI/CDSCO integration is mocked.</li>
        </ul>
      </section>

      <p className="mt-8 text-xs text-ink-mute">
        Built for Smart India Hackathon 2026 · Problem SIH26046 · MedTech / BioTech / HealthTech · Demo trial AIIA-AYU-026-DEMO.
      </p>
    </main>
  );
}
