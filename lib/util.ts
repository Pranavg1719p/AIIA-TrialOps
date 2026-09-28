export function nowIso(): string {
  return new Date().toISOString();
}

const DT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Kolkata",
});
const D = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});

/** "28 Sep 2026, 23:45 IST" */
export function fmtDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return DT.format(new Date(iso)).replace(",", ",") + " IST";
}

/** "28 Sep 2026" */
export function fmtD(iso: string | null | undefined): string {
  if (!iso) return "—";
  return D.format(new Date(iso));
}

export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function isPast(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86400000).toISOString();
}

export function todayIso(): string {
  return nowIso();
}

let counter = 0;
export function nid(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function requestId(): string {
  return "DEMO-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  PI: "Principal Investigator",
  COORDINATOR: "Trial Coordinator",
  MONITOR: "Monitor",
  PV_OFFICER: "PV Officer",
  ETHICS_MEMBER: "Ethics Member",
  LEADERSHIP: "Leadership",
};
