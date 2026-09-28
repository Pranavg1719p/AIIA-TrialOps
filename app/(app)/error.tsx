"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[aiia] page error", error);
  }, [error]);

  return (
    <div className="mx-auto my-10 max-w-lg rounded-lg border border-danger-line bg-danger-bg p-6" role="alert">
      <p className="text-sm font-bold uppercase tracking-wider text-danger">■ Unable to load this page</p>
      <p className="mt-2 text-sm text-ink-soft">
        Something went wrong while rendering this view. The demo server is still running — you can retry.
      </p>
      <p className="mt-1 text-xs text-ink-mute">Request ID: {error.digest ?? "DEMO-PAGE-ERR"}</p>
      <button type="button" onClick={reset} className="mt-4 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-stone-50">
        Retry
      </button>
    </div>
  );
}
