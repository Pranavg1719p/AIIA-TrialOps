import { cx } from "./ui";

/** Horizontal bar chart (server-rendered SVG-free: accessible divs). */
export function BarChartH({ data, unit }: { data: { label: string; value: number; sub?: string }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5 p-4">
      {data.map((d) => (
        <li key={d.label} className="text-xs">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <span className="font-medium text-ink-soft">{d.label}</span>
            <span className="font-semibold text-ink">{d.value}{unit ? ` ${unit}` : ""}{d.sub ? <span className="ml-1 font-normal text-ink-mute">{d.sub}</span> : null}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded bg-stone-100" role="img" aria-label={`${d.label}: ${d.value}${unit ? " " + unit : ""}`}>
            <div className="h-full rounded bg-brand/80" style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const DONUT_COLORS: Record<string, string> = {
  ok: "#166534", warn: "#d97706", danger: "#b91c1c", info: "#1d4ed8", neutral: "#a8a29e",
};

export function Donut({ title, segments, centerLabel, centerSub }: {
  title: string; segments: { label: string; value: number; tone: keyof typeof DONUT_COLORS }[];
  centerLabel: string; centerSub?: string;
}) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.value, 0));
  const R = 15.915; // circumference 100
  let offset = 25;
  return (
    <div className="flex items-center gap-4 p-4">
      <svg viewBox="0 0 42 42" className="h-28 w-28 shrink-0 -rotate-0" role="img" aria-label={`${title}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
        <circle cx="21" cy="21" r={R} fill="none" stroke="#f5f5f4" strokeWidth="6" />
        {segments.map((s) => {
          const len = (s.value / total) * 100;
          const el = (
            <circle key={s.label} cx="21" cy="21" r={R} fill="none" stroke={DONUT_COLORS[s.tone]} strokeWidth="6"
              strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={offset} />
          );
          offset -= len;
          return el;
        })}
        <text x="21" y="20.5" textAnchor="middle" className="fill-stone-900 text-[7px] font-semibold">{centerLabel}</text>
        {centerSub ? <text x="21" y="26" textAnchor="middle" className="fill-stone-500 text-[3.2px]">{centerSub}</text> : null}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-ink-soft">
              <span aria-hidden className={cx("inline-block h-2 w-2 shrink-0 rounded-sm")} style={{ background: DONUT_COLORS[s.tone] }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="font-semibold text-ink">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal milestone timeline for trial history. */
export function MilestoneTimeline({ milestones }: { milestones: { label: string; date: string; done: boolean; warn?: boolean }[] }) {
  return (
    <ol className="flex gap-0 overflow-x-auto px-4 pb-4 pt-2">
      {milestones.map((m, i) => (
        <li key={m.label} className="relative min-w-[120px] flex-1">
          <div className="flex items-center">
            <span aria-hidden className={cx("h-2.5 w-2.5 shrink-0 rounded-full", m.done ? (m.warn ? "bg-warn" : "bg-ok") : "bg-stone-300 ring-2 ring-stone-200")} />
            {i < milestones.length - 1 ? <span aria-hidden className={cx("h-0.5 flex-1", m.done ? "bg-ok/60" : "bg-stone-200")} /> : null}
          </div>
          <p className="mt-1.5 pr-2 text-[11px] font-medium text-ink-soft">{m.label}</p>
          <p className="text-[10px] text-ink-mute">{m.date}</p>
        </li>
      ))}
    </ol>
  );
}
