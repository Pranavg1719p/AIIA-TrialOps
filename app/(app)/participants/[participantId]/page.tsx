import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can, participantVisible, sessionUser } from "@/lib/auth";
import { db } from "@/lib/store";
import { activeTrial, enrollmentGate } from "@/lib/kpi";
import { fmtD, fmtDt, isPast } from "@/lib/util";
import { Card, CardHeader, DataTable, EmptyState, PageHeader, Provenance, ReadinessBanner, StatusBadge, cx } from "@/components/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ActionButton } from "@/components/action";
import { ConsentActions, EnrollGateActions, ScreeningChecklist } from "@/components/forms/participant";
import { CrfForm, LabForm, VisitCreate } from "@/components/forms/clinical";
import { QueryForm, QueryRespond, SafetyEventForm } from "@/components/forms/safety";
import { AccessDenied } from "@/components/access";

export const dynamic = "force-dynamic";

const TABS = [
  ["overview", "Overview"], ["screening", "Screening"], ["consent", "Consent"], ["enrollment", "Enrollment"],
  ["visits", "Visit Timeline"], ["crf", "CRF"], ["labs", "Labs"], ["safety", "Safety"], ["queries", "Queries"], ["audit", "Audit"],
] as const;

export default async function ParticipantPage({
  params, searchParams,
}: { params: { participantId: string }; searchParams: { tab?: string } }) {
  const user = sessionUser();
  if (!user) redirect("/");
  const d = db();
  const p = d.participants.find((x) => x.id === params.participantId);
  if (!p) notFound();
  if (!participantVisible(user, p)) {
    return <AccessDenied message="This participant belongs to a site outside your assigned monitoring scope, or your role cannot access participant-level data." />;
  }
  const site = d.sites.find((s) => s.id === p.siteId)!;
  const trial = d.trials.find((t) => t.id === p.trialId)!;
  const scr = d.screenings.find((s) => s.participantId === p.id);
  const consentHistory = d.consents.filter((c) => c.participantId === p.id);
  const consent = consentHistory.slice(-1)[0];
  const enrollment = d.enrollments.find((e) => e.participantId === p.id);
  const gate = enrollmentGate(p.id);
  const visits = d.visits.filter((v) => v.participantId === p.id).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const observations = d.observations.filter((o) => o.participantId === p.id);
  const labs = d.labResults.filter((l) => l.participantId === p.id);
  const safety = d.safetyEvents.filter((s) => s.participantId === p.id);
  const queries = d.queries.filter((q) => q.participantId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const outOfRange = labs.filter((l) => l.flag === "OUT_OF_RANGE");

  const isCoordinator = can(user.role, "crf.write");
  const isMonitor = user.role === "MONITOR";
  const tab = (searchParams.tab ?? "overview") as (typeof TABS)[number][0];
  const allowedTabs = TABS.filter(([t]) => (user.role === "PV_OFFICER" ? ["overview", "safety", "queries", "audit"].includes(t) : true));
  const activeTab = allowedTabs.some(([t]) => t === tab) ? tab : "overview";

  const nextVisit = visits.find((v) => v.status === "SCHEDULED");

  return (
    <>
      <Breadcrumbs />
      <PageHeader
        title={p.code}
        sub={<Provenance source="Trial schedule (synthetic)" createdBy={p.createdBy} createdAt={fmtDt(p.createdAt)} />}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={p.status} />
            <StatusBadge status={consent?.status ?? "PENDING"} />
            <StatusBadge status={gate.state === "ENROLLED" ? "ENROLLED" : gate.state} />
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Participant sections">
        {allowedTabs.map(([t, label]) => (
          <Link key={t} href={`/participants/${p.id}?tab=${t}`} role="tab" aria-selected={activeTab === t}
            className={cx("rounded-md px-3 py-1.5 text-xs font-semibold", activeTab === t ? "bg-brand text-white" : "border border-stone-200 bg-white text-ink-soft hover:bg-stone-50")}>
            {label}
          </Link>
        ))}
      </div>

      {/* ---------- OVERVIEW ---------- */}
      {activeTab === "overview" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Identity & scope" sub="Coded synthetic identity — no direct identifiers stored." />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 text-sm">
              {[
                ["Subject code", p.code], ["Trial", trial.code], ["Site", site.name],
                ["Status", p.status], ["Consent", consent?.status ?? "No record"],
                ["Enrollment", enrollment ? fmtD(enrollment.enrolledAt) : "Not enrolled"],
                ["Next visit", nextVisit ? `${nextVisit.type.replace("_", " ")} · ${fmtD(nextVisit.dueAt)}` : "—"],
                ["Open safety cases", String(safety.filter((s) => s.status !== "CLOSED").length)],
              ].map(([k, v]) => (
                <div key={k}><dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{k}</dt><dd className="mt-0.5 text-ink-soft">{v}</dd></div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Workflow position" sub="where this participant stands in the connected workflow" />
            <ol className="space-y-2 p-4 text-sm">
              {[
                ["Screening", scr?.items.every((i) => i.done) && scr?.piReviewedAt ? "COMPLETED" : "IN_REVIEW"],
                ["Consent", consent?.status ?? "PENDING"],
                ["Enrollment", enrollment ? "ENROLLED" : gate.state],
                ["Visits", `${visits.filter((v) => v.status === "COMPLETED").length} completed / ${visits.length} scheduled`],
                ["Safety", safety.length ? `${safety.filter((s) => s.status !== "CLOSED").length} open case(s)` : "No events"],
                ["Queries", queries.length ? `${queries.filter((q) => q.status !== "RESOLVED").length} open` : "None"],
              ].map(([label, st], i) => (
                <li key={label} className="flex items-center justify-between gap-2 rounded-md border border-stone-100 bg-stone-50/60 px-3 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink-mute">{i + 1}. {label}</span>
                  {/^[A-Z_]+$/.test(st) ? <StatusBadge status={st} /> : <span className="text-xs font-medium text-ink-soft">{st}</span>}
                </li>
              ))}
            </ol>
          </Card>
        </div>
      ) : null}

      {/* ---------- SCREENING ---------- */}
      {activeTab === "screening" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Screening checklist" sub="Protocol-defined checks. Derived rows auto-update from records." />
            <ScreeningChecklist
              participantId={p.id}
              canEdit={can(user.role, "screening.edit")}
              items={[
                ...(scr?.items.map((i) => ({ ...i, updatedAt: i.updatedAt ? fmtDt(i.updatedAt) : null })) ?? []),
                { key: "piReview", label: "PI / delegate review", done: !!scr?.piReviewedAt, updatedAt: scr?.piReviewedAt ? fmtDt(scr.piReviewedAt) : null, updatedBy: scr?.piReviewedBy ?? null, derived: true, derivedOk: !!scr?.piReviewedAt },
                { key: "consentAccepted", label: "Consent accepted", done: consent?.status === "ACCEPTED", updatedAt: consent ? fmtDt(consent.at) : null, updatedBy: consent?.staff ?? null, derived: true, derivedOk: consent?.status === "ACCEPTED" },
                { key: "siteActive", label: "Site active", done: site.status === "ACTIVE", updatedAt: null, updatedBy: null, derived: true, derivedOk: site.status === "ACTIVE" },
                { key: "ctriReady", label: "CTRI ready (registered, demo)", done: trial.ctri.state === "REGISTERED", updatedAt: null, updatedBy: null, derived: true, derivedOk: trial.ctri.state === "REGISTERED" },
              ]}
            />
            {scr?.notes ? <p className="border-t border-stone-100 px-4 py-2.5 text-xs italic text-ink-mute">Notes: {scr.notes}</p> : null}
          </Card>
          <Card>
            <CardHeader title="PI / delegate review" sub="Human eligibility decision — required before enrollment." />
            <div className="space-y-3 p-4">
              {scr?.piReviewedAt ? (
                <div className="flex items-center gap-2 text-sm text-ok">✓ Reviewed by {scr.piReviewedBy} · {fmtDt(scr.piReviewedAt)}</div>
              ) : can(user.role, "screening.piReview") ? (
                <ActionButton
                  url={`/api/participants/${p.id}/screening`}
                  body={{ piReview: true }} label="Record PI eligibility review" variant="primary"
                  confirm="Record PI review of eligibility? This unblocks the enrollment gate (if other checks pass)."
                  success="PI review recorded — enrollment gate recomputed."
                />
              ) : (
                <p className="text-xs text-ink-mute">PI or delegate review pending. {isMonitor ? "Read-only for monitors." : "Only the PI can record this review."}</p>
              )}
              <p className="text-[11px] text-ink-mute">Eligibility decisions are made by humans. The system only tracks state.</p>
            </div>
          </Card>
        </div>
      ) : null}

      {/* ---------- CONSENT ---------- */}
      {activeTab === "consent" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Consent" sub={`EC-approved demo version: ${trial.consentVersion}`} right={<StatusBadge status={consent?.status ?? "PENDING"} />} />
            {consent ? (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 text-sm">
                {[
                  ["Version", consent.version], ["Language", consent.language],
                  ["Status", consent.status], ["Last action", fmtDt(consent.at)],
                  ["Staff", consent.staff], ["Witness", consent.witness ?? "—"],
                  ["Signature", consent.signature ?? "Not captured (pending)"],
                  ["Reason / note", consent.reason ?? "—"],
                ].map(([k, v]) => (
                  <div key={k}><dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{k}</dt><dd className="mt-0.5 text-ink-soft">{v}</dd></div>
                ))}
              </dl>
            ) : (
              <EmptyState title="No consent record yet." />
            )}
            <div className="border-t border-stone-100">
              <ConsentActions participantId={p.id} status={consent?.status ?? "PENDING"} version={trial.consentVersion}
                canAct={can(user.role, "consent.act")} canWithdraw={can(user.role, "consent.withdraw")} staffName={user.name} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Consent history" sub="Immutable workflow history (accept / decline / withdraw all remain visible)" />
            <ol className="divide-y divide-stone-100">
              {consentHistory.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                  <div>
                    <p className="font-semibold text-ink">{c.status} <span className="font-normal text-ink-mute">· {c.language} · {c.version}</span></p>
                    <p className="text-ink-mute">{fmtDt(c.at)} · {c.staff}{c.reason ? ` · ${c.reason}` : ""}</p>
                  </div>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ol>
          </Card>
        </div>
      ) : null}

      {/* ---------- ENROLLMENT ---------- */}
      {activeTab === "enrollment" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Enrollment readiness gate" sub="Server-side evaluation of screening, consent, site, CTRI and duplicate checks" />
            <div className="space-y-3 p-4">
              <ReadinessBanner state={gate.state} blockers={gate.blockers} />
              <ul className="space-y-1.5 text-xs">
                {gate.checks.map((c) => (
                  <li key={c.label} className="flex items-center justify-between gap-2">
                    <span className={c.ok ? "text-ink-soft" : "font-medium text-danger"}>{c.ok ? "✓" : "✕"} {c.label}</span>
                    <span className="truncate text-[10px] text-ink-mute">{c.detail ?? ""}</span>
                  </li>
                ))}
              </ul>
              <EnrollGateActions participantId={p.id} gate={gate} canEnroll={can(user.role, "enroll")} code={p.code} siteId={p.siteId} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Enrollment record" sub={enrollment ? "Enrolled — visit schedule auto-created" : "Not enrolled yet"} />
            {enrollment ? (
              <div className="space-y-2 p-4 text-sm text-ink-soft">
                <p>Enrolled: <strong>{fmtDt(enrollment.enrolledAt)}</strong> by {enrollment.enrolledBy}</p>
                <p>Site: {site.name}</p>
                <p>Visit schedule created: {visits.map((v) => v.type.replace("_", " ")).join(" · ")}</p>
                <p className="text-[11px] text-ink-mute">Provenance: created from the enrollment gate decision; audit entry written automatically.</p>
              </div>
            ) : (
              <EmptyState title="No enrollment record." hint="Resolve gate blockers, then enroll. Enrollment is blocked for duplicate subject codes." />
            )}
          </Card>
        </div>
      ) : null}

      {/* ---------- VISITS ---------- */}
      {activeTab === "visits" ? (
        <div className="space-y-5">
          {isCoordinator && enrollment ? (
            <Card>
              <details>
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand">+ Schedule additional visit (Coordinator)</summary>
                <VisitCreate participantId={p.id} />
              </details>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Visit timeline" sub={`${visits.filter((v) => v.status === "COMPLETED").length} of ${visits.length} visits completed`} />
            {visits.length === 0 ? (
              <EmptyState title="No visits scheduled yet." hint="A visit schedule is created automatically at enrollment." />
            ) : (
              <ol className="divide-y divide-stone-100">
                {visits.map((v) => {
                  const overdue = v.status === "SCHEDULED" && isPast(v.dueAt);
                  const vObs = observations.filter((o) => o.visitId === v.id);
                  const vLabs = labs.filter((l) => l.visitId === v.id);
                  return (
                    <li key={v.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink">{v.type.replace("_", " ")}</span>
                          <StatusBadge status={overdue ? "OVERDUE" : v.status} />
                          <span className="text-xs text-ink-mute">Due {fmtD(v.dueAt)}{v.completedAt ? ` · Completed ${fmtD(v.completedAt)} by ${v.completedBy}` : ""}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {isCoordinator && enrollment && v.status === "SCHEDULED" ? (
                            <>
                              <ActionButton url="/api/visits" body={{ action: "complete", id: v.id }} label="Complete visit" small
                                success="Visit completed — timeline and completion KPI updated." />
                              <details className="inline">
                                <summary className="inline cursor-pointer rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-ink hover:bg-stone-50">Add observation (CRF)</summary>
                                <div className="mt-2 rounded-md border border-stone-200"><CrfForm visitId={v.id} participantId={p.id} /></div>
                              </details>
                              <details className="inline">
                                <summary className="inline cursor-pointer rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium text-ink hover:bg-stone-50">Add lab result</summary>
                                <div className="mt-2 rounded-md border border-stone-200"><LabForm participantId={p.id} visitId={v.id} /></div>
                              </details>
                            </>
                          ) : null}
                        </div>
                      </div>
                      {vObs.length > 0 || vLabs.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-ink-mute">
                          {vObs.map((o) => <span key={o.id} className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5">CRF saved {fmtD(o.createdAt)}{o.fields.assessmentScore === null ? " · ⚠ missing assessment score" : ` · score ${o.fields.assessmentScore}`}</span>)}
                          {vLabs.map((l) => <span key={l.id} className={`rounded border px-1.5 py-0.5 ${l.flag === "OUT_OF_RANGE" ? "border-danger-line bg-danger-bg text-danger" : "border-stone-200 bg-stone-50"}`}>{l.test}: {l.value} {l.unit}{l.flag === "OUT_OF_RANGE" ? " · out-of-range → human review" : ""}</span>)}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      ) : null}

      {/* ---------- CRF ---------- */}
      {activeTab === "crf" ? (
        <Card>
          <CardHeader title="CRF / observation records" sub="Protocol-defined fields only. No automatic clinical inference." />
          {observations.length === 0 ? <EmptyState title="No CRF records yet." hint="Add observations from the Visit Timeline tab." /> : (
            <DataTable head={["Visit", "Formulation", "Batch", "Dose", "Route", "Anupana", "Diet", "Assessment score", "Recorded"]}>
              {observations.map((o) => {
                const v = d.visits.find((x) => x.id === o.visitId);
                const missing = o.fields.assessmentScore === null || o.fields.assessmentScore === undefined;
                return (
                  <tr key={o.id} className={missing ? "bg-warn-bg/50" : ""}>
                    <td className="px-4 py-2.5 text-xs font-medium text-ink">{v?.type.replace("_", " ")}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-soft">{o.fields.formulation as string}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{o.fields.batch as string}</td>
                    <td className="px-4 py-2.5 text-xs">{o.fields.dose as number} {o.fields.doseUnit as string}</td>
                    <td className="px-4 py-2.5 text-xs">{o.fields.route as string}</td>
                    <td className="px-4 py-2.5 text-xs">{o.fields.anupana as string}</td>
                    <td className="px-4 py-2.5 text-xs">{o.fields.dietAdherence as string}</td>
                    <td className="px-4 py-2.5 text-xs">{missing ? <StatusBadge status="PENDING" /> : <strong>{o.fields.assessmentScore as number}/10</strong>}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink-mute">{fmtD(o.createdAt)} · {o.createdBy}</td>
                  </tr>
                );
              })}
            </DataTable>
          )}
        </Card>
      ) : null}

      {/* ---------- LABS ---------- */}
      {activeTab === "labs" ? (
        <div className="space-y-5">
          {outOfRange.length > 0 ? (
            <div className="rounded-lg border border-danger-line bg-danger-bg p-3 text-sm font-medium text-danger" role="alert">
              ■ Out-of-range result{outOfRange.length > 1 ? "s" : ""} present. Human review required — this system does not diagnose or recommend treatment.
            </div>
          ) : null}
          {isCoordinator ? (
            <Card>
              <details>
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand">+ Add lab result (Coordinator)</summary>
                <LabForm participantId={p.id} visitId={visits.find((v) => v.status === "SCHEDULED")?.id ?? null} />
              </details>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Lab results" sub="Values with reference ranges; out-of-range rows are flagged for human review" />
            {labs.length === 0 ? <EmptyState title="No lab results recorded." /> : (
              <DataTable head={["Test", "Value", "Reference range", "Collected", "Status", "Flag", "Recorded by"]}>
                {labs.map((l) => (
                  <tr key={l.id} className={l.flag === "OUT_OF_RANGE" ? "bg-danger-bg/50" : ""}>
                    <td className="px-4 py-2.5 text-xs font-medium text-ink">{l.test}</td>
                    <td className="px-4 py-2.5 text-xs font-semibold">{l.value} {l.unit}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-mute">{l.refLow} – {l.refHigh} {l.unit}</td>
                    <td className="px-4 py-2.5 text-xs">{fmtD(l.collectedAt)}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={l.status} /></td>
                    <td className="px-4 py-2.5">{l.flag === "OUT_OF_RANGE" ? <StatusBadge status="OUT_OF_RANGE" /> : <span className="text-xs text-ink-mute">—</span>}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink-mute">{l.createdBy}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>
      ) : null}

      {/* ---------- SAFETY ---------- */}
      {activeTab === "safety" ? (
        <div className="space-y-5">
          {can(user.role, "safety.create") && p.status === "ENROLLED" ? (
            <Card>
              <details>
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand">+ Report AE / SAE for {p.code} (Coordinator / PI)</summary>
                <SafetyEventForm participants={[{ id: p.id, code: p.code }]} />
              </details>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Safety events" sub="All data fictional. Humans determine causality, seriousness and regulatory applicability." right={<Link href="/safety" className="text-xs font-semibold text-brand hover:underline">PV workspace →</Link>} />
            {safety.length === 0 ? <EmptyState title="No adverse events recorded for this participant." /> : (
              <DataTable head={["Case", "Event", "Seriousness", "Severity", "Status", "Onset", ""]}>
                {safety.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{s.caseNo}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-soft">{s.term}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={s.seriousness} /></td>
                    <td className="px-4 py-2.5 text-xs">{s.severity}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-2.5 text-xs">{fmtD(s.onsetAt)}</td>
                    <td className="px-4 py-2.5 text-right"><Link href={`/safety?case=${s.id}`} className="text-xs font-semibold text-brand hover:underline">Open →</Link></td>
                  </tr>
                ))}
              </DataTable>
            )}
          </Card>
        </div>
      ) : null}

      {/* ---------- QUERIES ---------- */}
      {activeTab === "queries" ? (
        <div className="space-y-5">
          {can(user.role, "query.create") ? (
            <Card>
              <details>
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand">+ Raise query on {p.code} (Monitor / PI)</summary>
                <QueryForm
                  sites={d.sites.filter((s) => (user.role === "MONITOR" ? user.siteScope.includes(s.id) : true))}
                  participants={[{ id: p.id, code: p.code }]} defaultParticipantId={p.id} defaultSiteId={p.siteId}
                />
              </details>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Queries" sub="Lifecycle: OPEN → RESPONDED → RESOLVED (reviewer closes)" />
            {queries.length === 0 ? <EmptyState title="No queries on this participant." hint="“No open queries.” is a good state." /> : (
              <ul className="divide-y divide-stone-100">
                {queries.map((q) => {
                  const overdue = q.status !== "RESOLVED" && isPast(q.dueAt);
                  return (
                    <li key={q.id} className="space-y-2 px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-ink">{q.code}</span>
                          <StatusBadge status={overdue ? "OVERDUE" : q.status} />
                          <span className="text-xs text-ink-mute">{q.category} · due {fmtD(q.dueAt)} · raised by {q.createdBy}</span>
                        </div>
                        {can(user.role, "query.resolve") && q.status === "RESPONDED" ? (
                          <ActionButton url="/api/queries" body={{ id: q.id, action: "resolve" }} label="Resolve query" small
                            reason="Resolution note (reviewer closes the query)" success="Query resolved — open-queries KPI updated." />
                        ) : null}
                      </div>
                      <p className="text-sm text-ink-soft">{q.question}</p>
                      {q.response ? (
                        <div className="rounded-md border border-info-line bg-info-bg p-2.5 text-xs text-ink-soft">
                          <p><strong>Response</strong> ({fmtDt(q.response.at)} · {q.response.by}): {q.response.text}</p>
                          <p className="mt-1 text-ink-mute">Source context: {q.response.sourceContext}</p>
                        </div>
                      ) : null}
                      {q.resolution ? (
                        <div className="rounded-md border border-ok-line bg-ok-bg p-2.5 text-xs text-ink-soft">
                          <p><strong>Resolved</strong> ({fmtDt(q.resolution.at)} · {q.resolution.by}): {q.resolution.note}</p>
                        </div>
                      ) : null}
                      {isCoordinator && q.status === "OPEN" ? <QueryRespond queryId={q.id} /> : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {/* ---------- AUDIT ---------- */}
      {activeTab === "audit" ? (
        <Card>
          <CardHeader title="Participant audit history" sub="Application-level audit history — not a WORM/tamper-proof store." />
          <AuditForParticipant participantId={p.id} />
        </Card>
      ) : null}
    </>
  );
}

function AuditForParticipant({ participantId }: { participantId: string }) {
  const d = db();
  const ids = new Set<string>([participantId]);
  for (const v of d.visits.filter((v) => v.participantId === participantId)) ids.add(v.id);
  for (const o of d.observations.filter((o) => o.participantId === participantId)) ids.add(o.id);
  for (const l of d.labResults.filter((l) => l.participantId === participantId)) ids.add(l.id);
  for (const c of d.consents.filter((c) => c.participantId === participantId)) ids.add(c.id);
  for (const s of d.safetyEvents.filter((s) => s.participantId === participantId)) { ids.add(s.id); ids.add(s.caseNo); }
  for (const q of d.queries.filter((q) => q.participantId === participantId)) ids.add(q.id);
  for (const t of d.pvTasks.filter((t) => ids.has(t.caseId))) ids.add(t.id);
  const entries = d.auditLogs.filter((a) => ids.has(a.entityId)).slice(0, 40);
  if (!entries.length) return <EmptyState title="No audit entries for this participant yet." />;
  return (
    <ul className="divide-y divide-stone-100">
      {entries.map((a) => (
        <li key={a.id} className="px-4 py-2.5 text-xs">
          <p className="text-ink-mute">{fmtDt(a.at)}</p>
          <p className="text-ink-soft"><strong className="text-ink">{a.actor}</strong> ({a.role.replace(/_/g, " ")}) · {a.entity} · {a.action}
            {a.from || a.to ? <>: {a.from ?? "—"} → {a.to ?? "—"}</> : null}</p>
          {a.reason ? <p className="italic text-ink-mute">Reason: {a.reason}</p> : null}
        </li>
      ))}
    </ul>
  );
}
