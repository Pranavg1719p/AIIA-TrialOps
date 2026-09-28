"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

export function Sidebar({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/") || (href !== "/overview" && pathname.startsWith(href));

  return (
    <>
      <nav aria-label="Primary" className="hidden w-52 shrink-0 border-r border-stone-200 bg-white lg:block">
        <ul className="sticky top-14 space-y-0.5 p-3">
          {items.map((it) => (
            <li key={it.href}>
              <Link href={it.href} aria-current={isActive(it.href) ? "page" : undefined}
                className={cx("block rounded-md px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                  isActive(it.href) ? "bg-brand-tint text-brand" : "text-ink-soft hover:bg-stone-50 hover:text-ink")}>
                {it.label}
              </Link>
            </li>
          ))}
          <li className="mt-3 border-t border-stone-200 pt-3">
            <Link href="/about" className="block rounded-md px-3 py-2 text-xs text-ink-mute hover:bg-stone-50">About this prototype</Link>
          </li>
        </ul>
      </nav>
      <nav aria-label="Primary (compact)" className="border-b border-stone-200 bg-white lg:hidden">
        <ul className="flex gap-1 overflow-x-auto p-2">
          {items.map((it) => (
            <li key={it.href} className="shrink-0">
              <Link href={it.href} aria-current={isActive(it.href) ? "page" : undefined}
                className={cx("block whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium",
                  isActive(it.href) ? "bg-brand text-white" : "bg-stone-100 text-ink-soft")}>
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
