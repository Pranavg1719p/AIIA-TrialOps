import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">404 — not found</p>
      <h1 className="mt-2 text-xl font-semibold text-ink">This record or route does not exist.</h1>
      <p className="mt-2 text-sm text-ink-soft">The demo workspace is still running — head back to safety.</p>
      <Link href="/overview" className="mt-5 rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">← Back to Overview</Link>
    </main>
  );
}
