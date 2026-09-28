import Link from "next/link";

export function AccessDenied({ title = "Access restricted", message, hint }: { title?: string; message: string; hint?: string }) {
  return (
    <div className="mx-auto my-10 max-w-lg rounded-lg border border-danger-line bg-danger-bg p-6 text-center" role="alert">
      <p className="text-sm font-bold uppercase tracking-wider text-danger">■ {title}</p>
      <p className="mt-2 text-sm text-ink-soft">{message}</p>
      {hint ? <p className="mt-1 text-xs text-ink-mute">{hint}</p> : null}
      <Link href="/overview" className="mt-4 inline-block rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-stone-50">
        ← Back to Overview
      </Link>
    </div>
  );
}
