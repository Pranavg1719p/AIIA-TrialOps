"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  overview: "Overview", trials: "Trials", participants: "Participants", visits: "Visits",
  safety: "Safety", monitoring: "Monitoring", ethics: "Ethics & CTRI", reports: "Reports & Exports",
  audit: "Audit", "ai-assist": "AI Assist", settings: "Settings", about: "About",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return null;
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-[11px] text-ink-mute">
        <li><Link href="/overview" className="hover:text-brand hover:underline">Home</Link></li>
        {parts.map((p, i) => {
          const href = "/" + parts.slice(0, i + 1).join("/");
          const title = TITLES[p] ?? (p.startsWith("p-") ? p.replace("p-AYU-", "AYU-") : decodeURIComponent(p));
          return (
            <li key={href} className="flex items-center gap-1">
              <span aria-hidden>›</span>
              {i === parts.length - 1 ? <span className="font-medium text-ink-soft">{title}</span> : <Link href={href} className="hover:text-brand hover:underline">{title}</Link>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
