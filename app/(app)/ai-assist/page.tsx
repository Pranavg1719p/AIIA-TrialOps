import Link from "next/link";
import { redirect } from "next/navigation";
import { can, sessionUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { completenessFindings } from "@/lib/assistant";
import { fmtDt } from "@/lib/util";
import { Card, CardHeader, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AssistantActions, SummaryGenerator } from "@/components/forms/ops";

export const dynamic = "force-dynamic";

export default async function AiAssistPage() {
  const user = sessionUser();
  if (!user) redirect("/");
  if (!can(user.role, "assistant.read")) {
    return (
      <Card className="mx-auto my-10 max-w-lg">
        <EmptyState title="AI Assist is available to Coordinator, PI and Admin roles." />
      </Card>
    );
  }
  const d = db();
  const findings = completenessFindings(false);
  const dismissed = completenessFindings(true).filter((f) => d.assistant.dismissed.includes(f.key));
  const accepted = d.assistant.accepted;
  const canAct = can(user.role, "assistant.act");

  return (
    <>
      <Breadcrumbs />
      <PageHeader
        title="AI Assist"
        sub="Two deliberately bounded helpers. Rules-based process checks + aggregate summaries. No clinical AI — humans make every decision."
      />

      <Card>
        <CardHeader
          title="1 · Completeness & Deviation Assistant"
          sub="Rules-based checks: expected visit exists · expected CRF exists · expected lab exists · required form complete · query overdue."
          right={<StatusBadge status={findings.length ? "OPEN" : "COMPLETED"} />}
        />
        <div className="border-b border-stone-100 bg-stone-50 px-4 py-2 text-[11px] text-ink-mute">
          Rule output is a <strong>suggestion</strong>. Accept logs a corrective task to the coordinator queue; dismiss requires a reason. Both are audited.
        </div>
        {findings.length === 0 ? (
          <EmptyState title="No open findings." hint="“Potential completeness issue detected.” messages appear here when the rules match the current data." />
        ) : (
          <ul className="divide-y divide-stone-100">
            {findings.map((f) => (
              <li key={f.key} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={f.severity} />
                  <p className="text-sm font-semibold text-ink">{f.title}</p>
                </div>
                <dl className="mt-1.5 grid gap-1 text-xs sm:grid-cols-[110px_1fr]">
                  <dt className="font-semibold uppercase tracking-wide text-ink-mute">Rule</dt><dd className="text-ink-soft">{f.rule}</dd>
                  <dt className="font-semibold uppercase tracking-wide text-ink-mute">Source</dt><dd className="text-ink-soft">{f.source}</dd>
                  <dt className="font-semibold uppercase tracking-wide text-ink-mute">Suggested next action</dt><dd className="text-ink-soft">{f.suggestion}</dd>
                </dl>
                {canAct ? (
                  <AssistantActions findingKey={f.key} suggestion={f.suggestion} />
                ) : (
                  <p className="mt-1.5 text-[11px] text-ink-mute">Read-only view — Coordinator / PI accept or dismiss.</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {accepted.length > 0 ? (
          <div className="border-t border-stone-100 px-4 py-3">
            <p className="text-xs font-semibold text-ink">Accepted → coordinator queue</p>
            <ul className="mt-1.5 space-y-1">
              {accepted.slice(0, 6).map((a) => (
                <li key={a.key} className="rounded-md border border-ok-line bg-ok-bg px-2.5 py-1.5 text-xs text-ok">✓ {a.action} <span className="text-ink-mute">({a.by} · {fmtDt(a.at)})</span></li>
              ))}
            </ul>
          </div>
        ) : null}
        {dismissed.length > 0 ? (
          <details className="border-t border-stone-100">
            <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-ink-mute">Dismissed findings ({dismissed.length}) — kept in history</summary>
            <ul className="space-y-1 px-4 pb-3">
              {dismissed.map((f) => <li key={f.key} className="text-[11px] text-ink-mute">— {f.title}</li>)}
            </ul>
          </details>
        ) : null}
      </Card>

      <Card className="mt-5">
        <CardHeader
          title="2 · Aggregate Trial Summary"
          sub="Input: aggregate counts, milestones and KPIs only. No participant IDs, lab values, AE narratives or personal data."
        />
        <SummaryGenerator />
      </Card>

      <div className="mt-5 rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-mute">Hard boundaries (by design)</p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-soft">
          The assistant can never make eligibility decisions, diagnoses, causality or seriousness determinations,
          treatment recommendations, consent-validity judgements, or regulatory decisions. It flags process gaps and
          drafts aggregate narratives; <strong>humans decide and act</strong>. Example: “Visit 2 is expected but no completed
          visit record exists” → <Link href="/participants/p-AYU-0003?tab=visits" className="font-semibold text-brand hover:underline">review AYU-0003 visits →</Link>
        </p>
      </div>
    </>
  );
}
