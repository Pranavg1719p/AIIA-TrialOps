import { db } from "./store";
import { nid, nowIso } from "./util";
import type { AppNotification, AuditEntry, Role } from "./types";

export function logAudit(e: {
  actor: string;
  role: Role;
  entity: string;
  entityId: string;
  action: string;
  from?: string | null;
  to?: string | null;
  reason?: string | null;
}): AuditEntry {
  const entry: AuditEntry = {
    id: nid("aud"),
    at: nowIso(),
    actor: e.actor,
    role: e.role,
    entity: e.entity,
    entityId: e.entityId,
    action: e.action,
    from: e.from ?? null,
    to: e.to ?? null,
    reason: e.reason ?? null,
  };
  db().auditLogs.unshift(entry);
  return entry;
}

export function notify(n: { title: string; body: string; link: string; roles: Role[] }) {
  const notification: AppNotification = {
    id: nid("n"),
    at: nowIso(),
    title: n.title,
    body: n.body,
    link: n.link,
    roles: n.roles,
    readBy: [],
  };
  db().notifications.unshift(notification);
  return notification;
}
