import { cookies } from "next/headers";
import { db } from "./store";
import { errForbidden } from "./errors";
import type { Participant, Role, User } from "./types";

export const SESSION_COOKIE = "aiia_session";
export const DEMO_PASSWORD = "demo1234";

export type Perm =
  | "participant.read"
  | "participant.create"
  | "screening.edit"
  | "screening.piReview"
  | "consent.act"
  | "consent.withdraw"
  | "enroll"
  | "visit.write"
  | "crf.write"
  | "lab.write"
  | "safety.create"
  | "safety.piReview"
  | "pv.act"
  | "query.create"
  | "query.respond"
  | "query.resolve"
  | "finding.act"
  | "ethics.read"
  | "ethics.act"
  | "ctri.act"
  | "audit.read"
  | "kpi.read"
  | "report.view"
  | "export.create"
  | "assistant.read"
  | "assistant.act"
  | "settings.manage";

const ALL: Role[] = [
  "ADMIN",
  "PI",
  "COORDINATOR",
  "MONITOR",
  "PV_OFFICER",
  "ETHICS_MEMBER",
  "LEADERSHIP",
];
const CLINICAL: Role[] = ["ADMIN", "PI", "COORDINATOR", "MONITOR", "PV_OFFICER"];
const QA: Role[] = ["ADMIN", "PI", "COORDINATOR", "MONITOR"];

export const PERMS: Record<Perm, Role[]> = {
  "participant.read": CLINICAL,
  "participant.create": ["COORDINATOR"],
  "screening.edit": ["COORDINATOR"],
  "screening.piReview": ["PI"],
  "consent.act": ["COORDINATOR"],
  "consent.withdraw": ["COORDINATOR", "PI"],
  enroll: ["COORDINATOR"],
  "visit.write": ["COORDINATOR"],
  "crf.write": ["COORDINATOR"],
  "lab.write": ["COORDINATOR"],
  "safety.create": ["COORDINATOR", "PI"],
  "safety.piReview": ["PI"],
  "pv.act": ["PV_OFFICER"],
  "query.create": ["MONITOR", "PI"],
  "query.respond": ["COORDINATOR"],
  "query.resolve": ["MONITOR", "PI"],
  "finding.act": ["MONITOR", "PI"],
  "ethics.read": ALL,
  "ethics.act": ["ETHICS_MEMBER"],
  "ctri.act": ["PI", "ADMIN"],
  "audit.read": ["ADMIN", "PI", "COORDINATOR", "MONITOR", "PV_OFFICER", "ETHICS_MEMBER"],
  "kpi.read": ALL,
  "report.view": ALL,
  "export.create": ["ADMIN", "PI", "COORDINATOR"],
  "assistant.read": QA,
  "assistant.act": ["PI", "COORDINATOR"],
  "settings.manage": ["ADMIN"],
};

export function can(role: Role, perm: Perm): boolean {
  return PERMS[perm].includes(role);
}

export function sessionUser(): User | null {
  const id = cookies().get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return db().users.find((u) => u.id === id) ?? null;
}

export function requireUser(): User {
  const u = sessionUser();
  if (!u) throw errForbidden("Not signed in.");
  return u;
}

export function requirePerm(perm: Perm, message?: string): User {
  const u = requireUser();
  if (!can(u.role, perm)) throw errForbidden(message ?? `${u.role} is not permitted to: ${perm}.`);
  return u;
}

/** MONITOR accounts are restricted to their assigned sites. */
export function assertSiteScope(user: User, siteId: string) {
  if (user.role === "MONITOR" && !user.siteScope.includes(siteId)) {
    throw errForbidden("Site is outside your assigned monitoring scope.");
  }
}

export function participantVisible(user: User, p: Participant): boolean {
  if (user.role === "MONITOR") return user.siteScope.includes(p.siteId);
  return PERMS["participant.read"].includes(user.role);
}

export function visibleParticipants(user: User) {
  return db().participants.filter((p) => participantVisible(user, p));
}

export interface NavItem {
  href: string;
  label: string;
}

export function navFor(role: Role): NavItem[] {
  const items: [string, string, Role[]][] = [
    ["/overview", "Overview", ALL],
    ["/trials", "Trials", ALL],
    ["/participants", "Participants", CLINICAL],
    ["/visits", "Visits", ["ADMIN", "PI", "COORDINATOR", "MONITOR"]],
    [
      "/safety",
      "Safety",
      ["ADMIN", "PI", "COORDINATOR", "MONITOR", "PV_OFFICER"],
    ],
    ["/monitoring", "Monitoring", ["ADMIN", "PI", "COORDINATOR", "MONITOR"]],
    ["/ethics", "Ethics & CTRI", ALL],
    ["/reports", "Reports & Exports", ALL],
    ["/audit", "Audit", ["ADMIN", "PI", "COORDINATOR", "MONITOR", "PV_OFFICER", "ETHICS_MEMBER"]],
    ["/ai-assist", "AI Assist", ["ADMIN", "PI", "COORDINATOR"]],
    ["/settings", "Settings", ["ADMIN"]],
  ];
  return items.filter(([, , roles]) => roles.includes(role)).map(([href, label]) => ({ href, label }));
}
