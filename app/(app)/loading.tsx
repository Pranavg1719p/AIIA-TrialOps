export default function Loading() {
  return (
    <div className="animate-fadein" aria-live="polite" aria-busy="true">
      <div className="mb-5 h-6 w-48 animate-pulse rounded bg-stone-200" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border border-stone-200 bg-white" />
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-mute">Loading trial data…</p>
    </div>
  );
}
