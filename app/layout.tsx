import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "AIIA TrialOps — Synthetic Clinical Trial Operations Workspace",
  description:
    "One governed trial record. One connected workflow. SIH 2026 prototype (SIH26046). Synthetic demo data — not for clinical use.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[80] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop">
          Skip to content
        </a>
        {/* persistent synthetic-data banner */}
        <div role="note" className="bg-brand px-4 py-1.5 text-center text-[11px] font-bold uppercase tracking-[0.14em] text-white">
          Synthetic demo data — not for clinical use
        </div>
        {children}
      </body>
    </html>
  );
}
