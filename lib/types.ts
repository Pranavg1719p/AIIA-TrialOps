// Shared domain types for AIIA TrialOps (synthetic demo domain model).
export type Role =
  | "ADMIN"
  | "PI"
  | "COORDINATOR"
  | "MONITOR"
  | "PV_OFFICER"
  | "ETHICS_MEMBER"
  | "LEADERSHIP";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  siteScope: string[]; // site ids this account may access (MONITOR restriction)
}

export interface Site {
  id: string;
  code: string;
  name: string;
  city: string;
  status: "ACTIVE" | "INACTIVE";
}

export type CtriState = "DRAFT" | "REF" | "REGISTERED";

export interface CtriRecord {
  state: CtriState;
  ref: string | null; // REF number or registration number
  registeredAt: string | null;
  renewalDueAt: string | null;
}

export interface Trial {
  id: string;
  code: string;
  title: string;
  protocolVersion: string;
  intervention: string;
  phase: string;
  status: "ACTIVE" | "COMPLETED";
  targetEnrollment: number;
  baseEnrolled: number; // aggregate count for trials without seeded participant rows
  siteIds: string[];
  startDate: string;
  endDate: string;
  consentVersion: string;
  ctri: CtriRecord;
}

export type ParticipantStatus =
  | "SCREENING"
  | "SCREENED"
  | "ENROLLED"
  | "WITHDRAWN"
  | "SCREEN_FAILED";

export interface Participant {
  id: string;
  trialId: string;
  siteId: string;
  code: string;
  status: ParticipantStatus;
  createdAt: string;
  createdBy: string;
}

export interface ScreeningItem {
  key: string;
  label: string;
  done: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface ScreeningRecord {
  participantId: string;
  items: ScreeningItem[];
  piReviewedAt: string | null;
  piReviewedBy: string | null;
  notes: string;
}

export type ConsentStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "WITHDRAWN";

export interface ConsentRecord {
  id: string;
  participantId: string;
  version: string;
  language: string;
  status: ConsentStatus;
  at: string; // last action time
  staff: string;
  witness: string | null;
  signature: "Simulated (demo)" | null;
  reason: string | null;
}

export interface Enrollment {
  participantId: string;
  trialId: string;
  siteId: string;
  enrolledAt: string;
  enrolledBy: string;
}

export type VisitType = "SCREENING" | "BASELINE" | "V1" | "V2" | "V3" | "FOLLOW_UP";

export interface Visit {
  id: string;
  participantId: string;
  trialId: string;
  type: VisitType;
  dueAt: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  completedAt: string | null;
  completedBy: string | null;
}

export interface Observation {
  id: string;
  visitId: string;
  participantId: string;
  fields: Record<string, string | number | boolean | null>;
  createdAt: string;
  createdBy: string;
}

export interface LabResult {
  id: string;
  participantId: string;
  visitId: string | null;
  test: string;
  value: number;
  unit: string;
  refLow: number;
  refHigh: number;
  collectedAt: string;
  status: "FINAL" | "PENDING";
  flag: "OUT_OF_RANGE" | null;
  createdBy: string;
  createdAt: string;
}

export type SafetyStatus =
  | "IDENTIFIED"
  | "PI_REVIEW_PENDING"
  | "PI_REVIEWED"
  | "PV_IN_REVIEW"
  | "FOLLOW_UP"
  | "CLOSED";

export interface SafetyEvent {
  id: string;
  caseNo: string;
  participantId: string;
  trialId: string;
  term: string;
  narrative: string;
  onsetAt: string;
  awarenessAt: string;
  seriousness: "NON_SERIOUS" | "SERIOUS";
  seriousnessCriteria: string[];
  severity: "MILD" | "MODERATE" | "SEVERE";
  suspectedProduct: string;
  batch: string;
  outcome: string;
  status: SafetyStatus;
  piReviewedAt: string | null;
  createdBy: string;
  createdAt: string;
  log: { at: string; by: string; role: Role; text: string }[];
}

export interface PvTask {
  id: string;
  caseId: string;
  type: "COMPLETENESS_REVIEW" | "FOLLOW_UP";
  dueAt: string;
  status: "PENDING" | "IN_REVIEW" | "FOLLOW_UP_DUE" | "DONE";
  owner: string;
  createdAt: string;
}

export interface Query {
  id: string;
  code: string;
  trialId: string;
  siteId: string;
  participantId: string | null;
  visitId: string | null;
  category: string;
  question: string;
  dueAt: string;
  status: "OPEN" | "RESPONDED" | "RESOLVED";
  createdBy: string;
  createdAt: string;
  response: { text: string; sourceContext: string; at: string; by: string } | null;
  resolution: { note: string; at: string; by: string } | null;
}

export interface Finding {
  id: string;
  code: string;
  trialId: string;
  siteId: string;
  participantId: string | null;
  description: string;
  severity: "MINOR" | "MAJOR" | "NOTE";
  status: "OPEN" | "ACKNOWLEDGED" | "CLOSED";
  sourceContext: string;
  createdBy: string;
  createdAt: string;
}

export interface EthicsSubmission {
  id: string;
  code: string;
  trialId: string;
  siteId: string;
  docName: string;
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "EXPIRED";
  submittedAt: string;
  approvedAt: string | null;
  expiresAt: string | null;
  owner: string;
  reviewer: string | null;
  rationale: string | null;
}

export interface AppNotification {
  id: string;
  at: string;
  title: string;
  body: string;
  link: string;
  roles: Role[];
  readBy: Role[];
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  role: Role;
  entity: string;
  entityId: string;
  action: string;
  from: string | null;
  to: string | null;
  reason: string | null;
}

export interface ExportEvent {
  id: string;
  at: string;
  by: string;
  role: Role;
  kind: string;
}

export interface AcceptedFinding {
  key: string;
  at: string;
  by: string;
  action: string;
}

export interface AssistantState {
  dismissed: string[];
  accepted: AcceptedFinding[];
}

export interface DB {
  meta: { version: number; seededAt: string };
  users: User[];
  sites: Site[];
  trials: Trial[];
  participants: Participant[];
  screenings: ScreeningRecord[];
  consents: ConsentRecord[];
  enrollments: Enrollment[];
  visits: Visit[];
  observations: Observation[];
  labResults: LabResult[];
  safetyEvents: SafetyEvent[];
  pvTasks: PvTask[];
  queries: Query[];
  findings: Finding[];
  ethicsSubmissions: EthicsSubmission[];
  notifications: AppNotification[];
  auditLogs: AuditEntry[];
  exportsLog: ExportEvent[];
  assistant: AssistantState;
  judge: { startedAt: string | null; visited: string[] };
}

export interface CompletenessFinding {
  key: string;
  severity: "WARNING" | "INFO";
  title: string;
  rule: string;
  source: string;
  suggestion: string;
  link: string;
}
