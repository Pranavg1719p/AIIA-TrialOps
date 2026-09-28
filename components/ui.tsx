import Link from "next/link";
import type { ReactNode } from "react";

export function cx(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(" ");
}

/* ---------- status system (text + icon + colour, never colour alone) ---------- */
type Tone = "ok" | "warn" | "danger" | "info" | "neutral" | "brand";

const TONES: Record<string, Tone> = {
  READY: "ok", READY_FOR_ENROLLMENT: "ok", APPROVED: "ok", RESOLVED: "ok", COMPLETED: "ok",
  REGISTERED: "ok", ENROLLED: "ok", ACTIVE: "ok", ACCEPTED: "ok", FINAL: "ok", DONE: "ok",
  PENDING: "neutral", SCREENING: "neutral", SCHEDULED: "neutral", DRAFT: "neutral", SUBMITTED: "neutral",
  NON_SERIOUS: "neutral", MILD: "neutral", NOTE: "neutral", ACKNOWLEDGED: "neutral", SCREENED: "neutral",
  IN_REVIEW: "warn", UNDER_REVIEW: "warn", OPEN: "warn", RESPONDED: "info", FOLLOW_UP: "warn",
  REF: "warn", MODERATE: "warn", WARNING: "warn", MAJOR: "warn", INFO: "info",
  BLOCKED: "danger", EXPIRED: "danger", OVERDUE: "danger", CANCELLED: "danger", WITHDRAWN: "danger",
  DECLINED: "danger", SERIOUS: "danger", SEVERE: "danger", MINOR: "neutral",
  PI_REVIEW_PENDING: "danger", IDENTIFIED: "warn", FOLLOW_UP_DUE: "danger", OUT_OF_RANGE: "danger",
  SCREEN_FAILED: "danger", INACTIVE: "danger", COMPLETED_: "ok",
};

const ICONS: Partial<Record<Tone, string>> = { ok: "●", warn: "▲", danger: "■", info: "◆", neutral: "○" };

export function toneOf(status: string): Tone {
  return TONES[status] ?? "neutral";
}

export function labelOf(status: string): string {
  return status.replace(/_/g, " ");
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = toneOf(status);
  const map: Record<Tone, string> = {
    ok: "bg-ok-bg text-ok border-ok-line",
    warn: "bg-warn-bg text-warn border-warn-line",
    danger: "bg-danger-bg text-danger border-danger-line",
    info: "bg-info-bg text-info border-info-line",
    neutral: "bg-stone-100 text-ink-soft border-stone-200",
    brand: "bg-brand-tint text-brand border-brand/20",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", map[tone], className)}>
      <span aria-hidden className="text-[8px] leading-none">{ICONS[tone]}</span>
      {labelOf(status)}
    </span>
  );
}

/* ---------- primitives ---------- */
export function Card({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cx("rounded-lg border border-stone-200 bg-white shadow-card", className)}>{children}</section>;
}

export function CardHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {sub ? <p className="mt-0.5 text-xs text-ink-mute">{sub}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5">
      <BreadcrumbsStatic />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {sub ? <p className="mt-1 text-sm text-ink-soft">{sub}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

function BreadcrumbsStatic() {
  return null; // rendered by client <Breadcrumbs/> inside pages that need dynamic path context
}

export function KpiCard({ label, value, sub, href, tone = "neutral" }: {
  label: string; value: ReactNode; sub?: string; href?: string; tone?: Tone;
}) {
  const bar: Record<Tone, string> = {
    ok: "bg-ok", warn: "bg-warn", danger: "bg-danger", info: "bg-info", neutral: "bg-stone-300", brand: "bg-brand",
  };
  const inner = (
    <div className="relative overflow-hidden rounded-lg border border-stone-200 bg-white p-4 shadow-card transition-colors hover:border-stone-300">
      <span aria-hidden className={cx("absolute inset-y-0 left-0 w-1", bar[tone])} />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-ink-mute">{sub}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand rounded-lg" aria-label={`${label}: ${typeof value === "string" || typeof value === "number" ? value : ""} ${sub ?? ""}`}>{inner}</Link>
  ) : inner;
}

export function DataTable({ head, children, caption }: { head: string[]; children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        {caption ? <caption className="px-4 py-2 text-left text-xs text-ink-mute">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50">
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-ink-mute">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink-soft">{title}</p>
      {hint ? <p className="text-xs text-ink-mute">{hint}</p> : null}
    </div>
  );
}

export function ReadinessBanner({ state, blockers }: { state: "READY" | "BLOCKED" | "READY_TO_ENROLL" | "ENROLLED" | "READY_FOR_ENROLLMENT"; blockers?: string[] }) {
  const ready = state !== "BLOCKED";
  return (
    <div className={cx("rounded-lg border p-4", ready ? "border-ok-line bg-ok-bg" : "border-danger-line bg-danger-bg")} role="status">
      <div className="flex items-center gap-2">
        <StatusBadge status={ready ? state : "BLOCKED"} />
        <span className="text-sm font-medium text-ink">{ready ? (state === "READY_FOR_ENROLLMENT" ? "READY FOR ENROLLMENT" : "READY TO ENROLL") : "BLOCKED"}</span>
      </div>
      {blockers && blockers.length > 0 ? (
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-danger">
          {blockers.map((b) => <li key={b}>{b}</li>)}
        </ul>
      ) : null}
    </div>
  );
}

export function Field({ label, htmlFor, hint, error, children, required }: {
  label: string; htmlFor: string; hint?: string; error?: string | null; children: ReactNode; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-ink-soft">
        {label} {required ? <span className="text-brand">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-[11px] text-ink-mute">{hint}</p> : null}
      {error ? <p className="mt-1 text-[11px] font-medium text-danger" role="alert">{error}</p> : null}
    </div>
  );
}

export const inputCls =
  "w-full rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm text-ink placeholder:text-stone-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:bg-stone-50";

export function AuditTimeline({ entries }: { entries: { id: string; at: string; actor: string; role: string; entity: string; entityId: string; action: string; from: string | null; to: string | null; reason: string | null }[] }) {
  if (!entries.length) return <EmptyState title="No audit entries yet." hint="State-changing actions appear here instantly." />;
  return (
    <ol className="relative space-y-0 px-4 py-2">
      {entries.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4">
          <span aria-hidden className="mt-1 flex flex-col items-center">
            <span className="h-2 w-2 rounded-full bg-brand" />
            {i < entries.length - 1 ? <span className="mt-0.5 w-px flex-1 bg-stone-200" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-mute">{e.at ? new Date(e.at).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }) : ""} IST</p>
            <p className="mt-0.5 text-sm text-ink">
              <span className="font-medium">{e.actor}</span> <span className="text-ink-mute">({e.role.replace(/_/g, " ")})</span> · {e.entity} <span className="font-mono text-xs text-ink-soft">{e.entityId}</span>
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              {labelOf(e.action)}
              {e.from || e.to ? <>: <StatusBadge status={e.from ?? "—"} /><span className="mx-1">→</span><StatusBadge status={e.to ?? "—"} /></> : null}
            </p>
            {e.reason ? <p className="mt-0.5 text-xs italic text-ink-mute">Reason: {e.reason}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Provenance({ source, createdBy, createdAt }: { source: string; createdBy: string; createdAt: string }) {
  return (
    <p className="text-[11px] text-ink-mute">
      Source: {source} · Created by {createdBy} · {createdAt}
    </p>
  );
}

export function AsOf({ prefix = "As of" }: { prefix?: string }) {
  const now = new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
  return <span className="text-[11px] text-ink-mute">{prefix} {now} IST</span>;
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[11px] font-medium">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span className={cx("rounded px-1.5 py-0.5", i === current ? "bg-brand text-white" : i < current ? "bg-ok-bg text-ok" : "bg-stone-100 text-ink-mute")}>
            {i + 1}. {s}
          </span>
          {i < steps.length - 1 ? <span aria-hidden className="text-stone-300">→</span> : null}
        </li>
      ))}
    </ol>
  );
}
