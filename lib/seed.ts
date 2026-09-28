import type {
  ConsentRecord, DB, EthicsSubmission, Finding, LabResult, Observation, Participant,
  Query, SafetyEvent, ScreeningRecord, Site, Trial, User, Visit, PvTask, AppNotification, AuditEntry,
} from "./types";

const iso = (s: string) => new Date(s).toISOString();

export const DEMO_TRIAL_ID = "trial-026";
export const MAIN_SITE = "site-1";

export function buildSeed(version: number): DB {
  const users: User[] = [
    { id: "u-admin", email: "admin@demo.local", name: "System Admin", role: "ADMIN", siteScope: [] },
    { id: "u-pi", email: "pi@demo.local", name: "Dr. Arjun Rao", role: "PI", siteScope: [] },
    { id: "u-coordinator", email: "coordinator@demo.local", name: "Priya Nair", role: "COORDINATOR", siteScope: [] },
    { id: "u-monitor", email: "monitor@demo.local", name: "Vikram Desai", role: "MONITOR", siteScope: ["site-1"] },
    { id: "u-pv", email: "pv@demo.local", name: "Dr. Meera Iyer", role: "PV_OFFICER", siteScope: [] },
    { id: "u-ethics", email: "ethics@demo.local", name: "Dr. Sanjay Kulkarni", role: "ETHICS_MEMBER", siteScope: [] },
    { id: "u-leadership", email: "leadership@demo.local", name: "Anita Sharma", role: "LEADERSHIP", siteScope: [] },
  ];

  const sites: Site[] = [
    { id: "site-1", code: "SITE-01", name: "AIIA Demo Site — New Delhi (Main)", city: "New Delhi", status: "ACTIVE" },
    { id: "site-2", code: "SITE-02", name: "AIIA Demo Site — Jaipur", city: "Jaipur", status: "ACTIVE" },
    { id: "site-3", code: "SITE-03", name: "AIIA Demo Site — Nagpur", city: "Nagpur", status: "ACTIVE" },
  ];

  const trials: Trial[] = [
    {
      id: DEMO_TRIAL_ID, code: "AIIA-AYU-026-DEMO",
      title: "Multisite evaluation of a synthetic Ayurvedic formulation in Amavata (demo protocol)",
      protocolVersion: "v1.2", intervention: "AYU-Form-A (synthetic formulation, demo)", phase: "II (demo)",
      status: "ACTIVE", targetEnrollment: 40, baseEnrolled: 0, siteIds: ["site-1", "site-2", "site-3"],
      startDate: iso("2026-04-10T09:00:00+05:30"), endDate: iso("2027-03-31T17:00:00+05:30"),
      consentVersion: "ICF v1.2 (EC-approved demo)",
      ctri: { state: "REGISTERED", ref: "CTRI/2026/DEMO/0261", registeredAt: iso("2026-04-02T12:00:00+05:30"), renewalDueAt: iso("2026-10-19T17:00:00+05:30") },
    },
    {
      id: "trial-031", code: "AIIA-AYU-031-DEMO",
      title: "Dose optimisation study of a synthetic herbal co-prescription (demo)",
      protocolVersion: "v1.0", intervention: "AYU-Form-B (synthetic, demo)", phase: "I (demo)",
      status: "ACTIVE", targetEnrollment: 60, baseEnrolled: 18, siteIds: ["site-1", "site-2"],
      startDate: iso("2026-06-01T09:00:00+05:30"), endDate: iso("2027-06-30T17:00:00+05:30"),
      consentVersion: "ICF v1.0 (EC-approved demo)",
      ctri: { state: "REF", ref: "CTRI/REF/2026/0312", registeredAt: null, renewalDueAt: null },
    },
    {
      id: "trial-007", code: "AIIA-KATU-007-DEMO",
      title: "Observational follow-up cohort, synthetic Katu-taila reference set (demo)",
      protocolVersion: "v2.0", intervention: "Observational (no product, demo)", phase: "IV (demo)",
      status: "ACTIVE", targetEnrollment: 30, baseEnrolled: 27, siteIds: ["site-1"],
      startDate: iso("2025-11-15T09:00:00+05:30"), endDate: iso("2026-12-15T17:00:00+05:30"),
      consentVersion: "ICF v2.0 (EC-approved demo)",
      ctri: { state: "REGISTERED", ref: "CTRI/2025/DEMO/0074", registeredAt: iso("2025-10-20T12:00:00+05:30"), renewalDueAt: iso("2027-10-19T17:00:00+05:30") },
    },
  ];

  const participants: Participant[] = [];
  const screenings: ScreeningRecord[] = [];
  const consents: ConsentRecord[] = [];
  const enrollments: DB["enrollments"] = [];
  const visits: Visit[] = [];
  const observations: Observation[] = [];
  const labResults: LabResult[] = [];

  const manualItems = [
    { key: "eligibilityReviewed", label: "Eligibility reviewed" },
    { key: "inclusion", label: "Inclusion criteria confirmed" },
    { key: "exclusion", label: "Exclusion criteria confirmed" },
    { key: "protocolAssessment", label: "Protocol-specific assessment completed" },
  ];

  const siteFor = (n: number) => (n <= 12 ? "site-1" : n <= 20 ? "site-2" : "site-3");
  const langFor = (n: number) => ["English", "Hindi", "Marathi"][n % 3];
  const overlapIds = new Set([3, 19]); // V2 overdue → expected-but-missing visits
  const crfGapIds = new Set([5, 14]); // required CRF field missing at V1

  // 24 enrolled participants AYU-0001..AYU-0024
  for (let i = 1; i <= 24; i++) {
    const code = `AYU-${String(i).padStart(4, "0")}`;
    const pid = `p-${code}`;
    const siteId = siteFor(i);
    const enrolled = new Date(new Date(iso("2026-05-20T10:30:00+05:30")).getTime() + (i - 1) * 86400000).toISOString();
    const staff = "Priya Nair (Coordinator)";

    participants.push({ id: pid, trialId: DEMO_TRIAL_ID, siteId, code, status: "ENROLLED", createdAt: enrolled, createdBy: staff });
    screenings.push({
      participantId: pid, notes: "",
      piReviewedAt: enrolled, piReviewedBy: "Dr. Arjun Rao (PI)",
      items: manualItems.map((m) => ({ ...m, done: true, updatedAt: enrolled, updatedBy: staff })),
    });
    consents.push({
      id: `c-${code}`, participantId: pid, version: "ICF v1.2 (EC-approved demo)", language: langFor(i),
      status: "ACCEPTED", at: enrolled, staff, witness: i % 2 ? "R. Kulkarni (site staff)" : null,
      signature: "Simulated (demo)", reason: null,
    });
    enrollments.push({ participantId: pid, trialId: DEMO_TRIAL_ID, siteId, enrolledAt: enrolled, enrolledBy: staff });

    const v2Due = new Date(new Date(enrolled).getTime() + 45 * 86400000).toISOString();
    const v2Done = !overlapIds.has(i);
    const visitDefs: [Visit["type"], string, Visit["status"], string | null, string | null][] = [
      ["SCREENING", new Date(new Date(enrolled).getTime() - 10 * 86400000).toISOString(), "COMPLETED", enrolled, staff],
      ["BASELINE", enrolled, "COMPLETED", enrolled, staff],
      ["V1", new Date(new Date(enrolled).getTime() + 14 * 86400000).toISOString(), "COMPLETED", new Date(new Date(enrolled).getTime() + 14 * 86400000).toISOString(), staff],
      ["V2", v2Due, v2Done ? "COMPLETED" : "SCHEDULED", v2Done ? v2Due : null, v2Done ? staff : null],
      ["V3", iso("2026-10-15T10:00:00+05:30"), "SCHEDULED", null, null],
      ["FOLLOW_UP", iso("2026-11-30T10:00:00+05:30"), "SCHEDULED", null, null],
    ];
    visitDefs.forEach(([type, dueAt, status, completedAt, completedBy], vi) => {
      visits.push({ id: `v-${code}-${type}`, participantId: pid, trialId: DEMO_TRIAL_ID, type, dueAt, status, completedAt, completedBy });
    });

    const crf = (visitId: string, at: string, noScore = false): Observation => ({
      id: `o-${visitId}`, visitId, participantId: pid,
      fields: {
        formulation: "AYU-Form-A (demo)", batch: "BATCH-2026-014", dose: 500, doseUnit: "mg",
        route: "Oral", anupana: "Warm water", dietAdherence: "Protocol diet followed",
        lifestyleCompliance: true, assessmentScore: noScore ? null : 3 + ((i + vi9(visitId)) % 6),
        notes: null,
      },
      createdAt: at, createdBy: staff,
    });
    observations.push(crf(`v-${code}-BASELINE`, enrolled));
    observations.push(crf(`v-${code}-V1`, new Date(new Date(enrolled).getTime() + 14 * 86400000).toISOString(), crfGapIds.has(i)));
    if (v2Done) observations.push(crf(`v-${code}-V2`, v2Due));

    labResults.push({
      id: `lab-${code}-HB`, participantId: pid, visitId: `v-${code}-BASELINE`, test: "Haemoglobin (Hb)",
      value: 12.4 + (i % 8) * 0.2, unit: "g/dL", refLow: 12, refHigh: 15,
      collectedAt: enrolled, status: "FINAL", flag: null, createdBy: staff, createdAt: enrolled,
    });
    labResults.push({
      id: `lab-${code}-ESR`, participantId: pid, visitId: `v-${code}-BASELINE`, test: "Erythrocyte Sedimentation Rate (ESR)",
      value: i === 11 ? 34 : 8 + (i % 5) * 3, unit: "mm/hr", refLow: 0, refHigh: 20,
      collectedAt: enrolled, status: "FINAL", flag: i === 11 ? "OUT_OF_RANGE" : null, createdBy: staff, createdAt: enrolled,
    });
    if (i === 16) {
      const v1 = new Date(new Date(enrolled).getTime() + 14 * 86400000).toISOString();
      labResults.push({
        id: `lab-${code}-V1HB`, participantId: pid, visitId: `v-${code}-V1`, test: "Haemoglobin (Hb)",
        value: 9.8, unit: "g/dL", refLow: 12, refHigh: 15, collectedAt: v1, status: "FINAL",
        flag: "OUT_OF_RANGE", createdBy: staff, createdAt: v1,
      });
    }
  }

  // AYU-0025 — screened, PI-reviewed; consent pending → single blocker; passes gate once consent accepted.
  const p25 = "p-AYU-0025";
  participants.push({ id: p25, trialId: DEMO_TRIAL_ID, siteId: "site-1", code: "AYU-0025", status: "SCREENED", createdAt: iso("2026-09-18T11:00:00+05:30"), createdBy: "Priya Nair (Coordinator)" });
  screenings.push({
    participantId: p25, notes: "Eligibility confirmed at screening visit (demo).",
    piReviewedAt: iso("2026-09-22T15:00:00+05:30"), piReviewedBy: "Dr. Arjun Rao (PI)",
    items: manualItems.map((m) => ({ ...m, done: true, updatedAt: iso("2026-09-21T10:00:00+05:30"), updatedBy: "Priya Nair (Coordinator)" })),
  });
  consents.push({ id: "c-AYU-0025", participantId: p25, version: "ICF v1.2 (EC-approved demo)", language: "Hindi", status: "PENDING", at: iso("2026-09-21T10:05:00+05:30"), staff: "Priya Nair (Coordinator)", witness: null, signature: null, reason: null });

  // AYU-0026 — screening in progress → multiple blockers (stays blocked to demo exact blockers).
  const p26 = "p-AYU-0026";
  participants.push({ id: p26, trialId: DEMO_TRIAL_ID, siteId: "site-1", code: "AYU-0026", status: "SCREENING", createdAt: iso("2026-09-24T09:30:00+05:30"), createdBy: "Priya Nair (Coordinator)" });
  screenings.push({
    participantId: p26, notes: "",
    piReviewedAt: null, piReviewedBy: null,
    items: manualItems.map((m) => ({ ...m, done: m.key === "eligibilityReviewed" || m.key === "inclusion", updatedAt: iso("2026-09-24T09:40:00+05:30"), updatedBy: "Priya Nair (Coordinator)" })),
  });
  consents.push({ id: "c-AYU-0026", participantId: p26, version: "ICF v1.2 (EC-approved demo)", language: "Marathi", status: "PENDING", at: iso("2026-09-24T09:45:00+05:30"), staff: "Priya Nair (Coordinator)", witness: null, signature: null, reason: null });

  const safetyEvents: SafetyEvent[] = [
    {
      id: "se-001", caseNo: "SAE-DEMO-001", participantId: "p-AYU-0004", trialId: DEMO_TRIAL_ID,
      term: "Hospitalisation — forearm fracture after fall (synthetic)",
      narrative: "Participant reported fall at home; X-ray confirmed forearm fracture; hospitalised for 2 days. Investigator notes event appears accidental; assessment is a human decision (demo).",
      onsetAt: iso("2026-09-18T08:00:00+05:30"), awarenessAt: iso("2026-09-18T10:00:00+05:30"),
      seriousness: "SERIOUS", seriousnessCriteria: ["Hospitalisation"], severity: "MODERATE",
      suspectedProduct: "AYU-Form-A (demo)", batch: "BATCH-2026-014", outcome: "Under treatment (demo)",
      status: "PI_REVIEW_PENDING", piReviewedAt: null, createdBy: "Priya Nair (Coordinator)",
      createdAt: iso("2026-09-18T11:30:00+05:30"),
      log: [{ at: iso("2026-09-18T11:30:00+05:30"), by: "Priya Nair (Coordinator)", role: "COORDINATOR", text: "Initial SAE record created; PV follow-up task auto-created." }],
    },
    {
      id: "se-102", caseNo: "AE-DEMO-102", participantId: "p-AYU-0011", trialId: DEMO_TRIAL_ID,
      term: "Mild nausea after dose (synthetic)", narrative: "Transient nausea 30 minutes after morning dose on two consecutive days; dietary cause suspected by coordinator (demo note only).",
      onsetAt: iso("2026-09-12T09:00:00+05:30"), awarenessAt: iso("2026-09-12T09:30:00+05:30"),
      seriousness: "NON_SERIOUS", seriousnessCriteria: [], severity: "MILD",
      suspectedProduct: "AYU-Form-A (demo)", batch: "BATCH-2026-014", outcome: "Recovering (demo)",
      status: "FOLLOW_UP", piReviewedAt: iso("2026-09-13T09:00:00+05:30"), createdBy: "Priya Nair (Coordinator)",
      createdAt: iso("2026-09-12T10:00:00+05:30"),
      log: [{ at: iso("2026-09-13T09:00:00+05:30"), by: "Dr. Arjun Rao (PI)", role: "PI", text: "PI review completed. Continue follow-up." }],
    },
    {
      id: "se-107", caseNo: "AE-DEMO-107", participantId: "p-AYU-0016", trialId: DEMO_TRIAL_ID,
      term: "Headache, mild (synthetic)", narrative: "Self-limiting headache reported at V1; resolved same evening per participant.",
      onsetAt: iso("2026-09-08T14:00:00+05:30"), awarenessAt: iso("2026-09-08T15:00:00+05:30"),
      seriousness: "NON_SERIOUS", seriousnessCriteria: [], severity: "MILD",
      suspectedProduct: "AYU-Form-A (demo)", batch: "BATCH-2026-014", outcome: "",
      status: "IDENTIFIED", piReviewedAt: null, createdBy: "Priya Nair (Coordinator)",
      createdAt: iso("2026-09-08T16:00:00+05:30"),
      log: [{ at: iso("2026-09-08T16:00:00+05:30"), by: "Priya Nair (Coordinator)", role: "COORDINATOR", text: "Initial AE record created." }],
    },
    {
      id: "se-088", caseNo: "AE-DEMO-088", participantId: "p-AYU-0002", trialId: DEMO_TRIAL_ID,
      term: "Rash at injection-site analogue — oral route irritation (synthetic)", narrative: "Mild oral irritation; resolved without intervention.",
      onsetAt: iso("2026-08-20T09:00:00+05:30"), awarenessAt: iso("2026-08-20T09:30:00+05:30"),
      seriousness: "NON_SERIOUS", seriousnessCriteria: [], severity: "MILD",
      suspectedProduct: "AYU-Form-A (demo)", batch: "BATCH-2026-011", outcome: "Resolved (demo)",
      status: "CLOSED", piReviewedAt: iso("2026-08-21T10:00:00+05:30"), createdBy: "Priya Nair (Coordinator)",
      createdAt: iso("2026-08-20T10:00:00+05:30"),
      log: [
        { at: iso("2026-08-21T10:00:00+05:30"), by: "Dr. Arjun Rao (PI)", role: "PI", text: "PI review completed." },
        { at: iso("2026-08-30T12:00:00+05:30"), by: "Dr. Meera Iyer (PV Officer)", role: "PV_OFFICER", text: "Case closed after completeness review (demo)." },
      ],
    },
  ];

  const pvTasks: PvTask[] = [
    { id: "pt-001", caseId: "se-001", type: "FOLLOW_UP", dueAt: iso("2026-09-30T17:00:00+05:30"), status: "FOLLOW_UP_DUE", owner: "Dr. Meera Iyer (PV Officer)", createdAt: iso("2026-09-18T11:30:00+05:30") },
    { id: "pt-002", caseId: "se-102", type: "FOLLOW_UP", dueAt: iso("2026-09-29T17:00:00+05:30"), status: "FOLLOW_UP_DUE", owner: "Dr. Meera Iyer (PV Officer)", createdAt: iso("2026-09-12T10:00:00+05:30") },
    { id: "pt-003", caseId: "se-107", type: "COMPLETENESS_REVIEW", dueAt: iso("2026-10-02T17:00:00+05:30"), status: "PENDING", owner: "Dr. Meera Iyer (PV Officer)", createdAt: iso("2026-09-08T16:00:00+05:30") },
    { id: "pt-004", caseId: "se-088", type: "COMPLETENESS_REVIEW", dueAt: iso("2026-08-25T17:00:00+05:30"), status: "DONE", owner: "Dr. Meera Iyer (PV Officer)", createdAt: iso("2026-08-20T10:00:00+05:30") },
  ];

  const queries: Query[] = [
    { id: "q-101", code: "Q-101", trialId: DEMO_TRIAL_ID, siteId: "site-1", participantId: "p-AYU-0003", visitId: "v-AYU-0003-V2", category: "Visit data", question: "Visit 2 window has elapsed with no completed visit record. Confirm whether the visit occurred and provide a source note.", dueAt: iso("2026-09-22T17:00:00+05:30"), status: "OPEN", createdBy: "Vikram Desai (Monitor)", createdAt: iso("2026-09-15T11:00:00+05:30"), response: null, resolution: null },
    { id: "q-102", code: "Q-102", trialId: DEMO_TRIAL_ID, siteId: "site-1", participantId: "p-AYU-0011", visitId: null, category: "Lab", question: "Baseline ESR (34 mm/hr) is above the reference range. Attach source report and site context. Note: human review required — no automated clinical interpretation.", dueAt: iso("2026-10-05T17:00:00+05:30"), status: "OPEN", createdBy: "Vikram Desai (Monitor)", createdAt: iso("2026-09-16T09:30:00+05:30"), response: null, resolution: null },
    { id: "q-103", code: "Q-103", trialId: DEMO_TRIAL_ID, siteId: "site-3", participantId: "p-AYU-0021", visitId: null, category: "Consent", question: "Consent language recorded as English while site log indicates Hindi document was signed. Clarify which version was used.", dueAt: iso("2026-10-04T17:00:00+05:30"), status: "OPEN", createdBy: "Vikram Desai (Monitor)", createdAt: iso("2026-09-17T10:15:00+05:30"), response: null, resolution: null },
    { id: "q-104", code: "Q-104", trialId: DEMO_TRIAL_ID, siteId: "site-1", participantId: "p-AYU-0007", visitId: "v-AYU-0007-BASELINE", category: "Dates", question: "Baseline visit date in CRF differs from source note by one day. Confirm the actual visit date.", dueAt: iso("2026-09-30T17:00:00+05:30"), status: "RESPONDED", createdBy: "Vikram Desai (Monitor)", createdAt: iso("2026-09-14T15:00:00+05:30"), response: { text: "Source note verified; actual visit date is 29 May 2026. CRF corrected against source.", sourceContext: "Site file S-0007/baseline page 2", at: iso("2026-09-20T12:00:00+05:30"), by: "Priya Nair (Coordinator)" }, resolution: null },
    { id: "q-105", code: "Q-105", trialId: DEMO_TRIAL_ID, siteId: "site-1", participantId: "p-AYU-0014", visitId: "v-AYU-0014-V1", category: "Product", question: "Batch number illegible on V1 CRF scan. Confirm batch from dispensing log.", dueAt: iso("2026-10-08T17:00:00+05:30"), status: "RESPONDED", createdBy: "Vikram Desai (Monitor)", createdAt: iso("2026-09-10T10:00:00+05:30"), response: { text: "Dispensing log confirms BATCH-2026-014 for this participant at V1.", sourceContext: "Dispensing log 2026-07, page 14", at: iso("2026-09-12T09:00:00+05:30"), by: "Priya Nair (Coordinator)" }, resolution: null },
    { id: "q-091", code: "Q-091", trialId: DEMO_TRIAL_ID, siteId: "site-2", participantId: "p-AYU-0002", visitId: "v-AYU-0002-BASELINE", category: "Dates", question: "Screening date recorded after enrollment date. Correct sequence.", dueAt: iso("2026-08-05T17:00:00+05:30"), status: "RESOLVED", createdBy: "Vikram Desai (Monitor)", createdAt: iso("2026-08-01T09:00:00+05:30"), response: { text: "Transcription error; screening date corrected to 19 Jun 2026.", sourceContext: "Site file S-0002 screening note", at: iso("2026-08-04T11:00:00+05:30"), by: "Priya Nair (Coordinator)" }, resolution: { note: "Response consistent with source. Closing query.", at: iso("2026-08-05T10:00:00+05:30"), by: "Vikram Desai (Monitor)" } },
    { id: "q-095", code: "Q-095", trialId: DEMO_TRIAL_ID, siteId: "site-2", participantId: "p-AYU-0010", visitId: "v-AYU-0010-V1", category: "CRF", question: "Anupana field blank at V1. Provide value per source.", dueAt: iso("2026-08-20T17:00:00+05:30"), status: "RESOLVED", createdBy: "Vikram Desai (Monitor)", createdAt: iso("2026-08-12T09:00:00+05:30"), response: { text: "Anupana recorded as warm water per case sheet; CRF updated.", sourceContext: "Case sheet S-0010/V1", at: iso("2026-08-18T14:00:00+05:30"), by: "Priya Nair (Coordinator)" }, resolution: { note: "Verified against source. Closed.", at: iso("2026-08-21T09:30:00+05:30"), by: "Vikram Desai (Monitor)" } },
  ];

  const findings: Finding[] = [
    { id: "mf-001", code: "MF-001", trialId: DEMO_TRIAL_ID, siteId: "site-1", participantId: "p-AYU-0005", description: "Assessment score not recorded at V1. Source CRF print confirms blank field.", severity: "MINOR", status: "OPEN", sourceContext: "Site file S-0005/V1", createdBy: "Vikram Desai (Monitor)", createdAt: iso("2026-09-16T10:00:00+05:30") },
    { id: "mf-002", code: "MF-002", trialId: DEMO_TRIAL_ID, siteId: "site-1", participantId: null, description: "Delegation log updated on 12 Sep 2026 to add backup coordinator.", severity: "NOTE", status: "ACKNOWLEDGED", sourceContext: "Delegation log v3", createdBy: "Vikram Desai (Monitor)", createdAt: iso("2026-09-14T09:00:00+05:30") },
  ];

  const ethicsSubmissions: EthicsSubmission[] = [
    { id: "ec-026-a", code: "EC-026-A", trialId: DEMO_TRIAL_ID, siteId: "site-1", docName: "IEC approval letter + approved ICF v1.2 (demo)", status: "APPROVED", submittedAt: iso("2026-04-20T10:00:00+05:30"), approvedAt: iso("2026-05-12T12:00:00+05:30"), expiresAt: iso("2027-05-11T17:00:00+05:30"), owner: "Dr. Arjun Rao (PI)", reviewer: "Dr. Sanjay Kulkarni (Ethics Member)", rationale: "Approved protocol v1.2 and ICF v1.2 for Site 1 (demo decision)." },
    { id: "ec-026-b", code: "EC-026-B", trialId: DEMO_TRIAL_ID, siteId: "site-2", docName: "IEC approval letter + approved ICF v1.2 (demo)", status: "APPROVED", submittedAt: iso("2026-06-10T10:00:00+05:30"), approvedAt: iso("2026-08-02T12:00:00+05:30"), expiresAt: iso("2027-01-20T17:00:00+05:30"), owner: "Dr. Arjun Rao (PI)", reviewer: "Dr. Sanjay Kulkarni (Ethics Member)", rationale: "Approved for Site 2 with administrative changes (demo decision)." },
    { id: "ec-026-c", code: "EC-026-C", trialId: DEMO_TRIAL_ID, siteId: "site-3", docName: "IEC approval letter v1.1 (demo)", status: "EXPIRED", submittedAt: iso("2026-03-02T10:00:00+05:30"), approvedAt: iso("2025-09-16T12:00:00+05:30"), expiresAt: iso("2026-09-16T17:00:00+05:30"), owner: "Dr. Arjun Rao (PI)", reviewer: "Dr. Sanjay Kulkarni (Ethics Member)", rationale: "Approval lapsed on 16 Sep 2026. Renewal required before further enrollment at Site 3." },
  ];

  const notifications: AppNotification[] = [
    { id: "n-1", at: iso("2026-09-18T11:31:00+05:30"), title: "SAE awaits PI review", body: "SAE-DEMO-001 (AYU-0004) created. PI review and PV follow-up are pending.", link: "/safety?case=se-001", roles: ["PI", "COORDINATOR", "PV_OFFICER", "ADMIN"], readBy: [] },
    { id: "n-2", at: iso("2026-09-16T09:00:00+05:30"), title: "Ethics approval expired — Site 3", body: "EC-026-C expired on 16 Sep 2026. Enrollment at Site 3 is paused pending renewal.", link: "/ethics", roles: ["PI", "COORDINATOR", "ETHICS_MEMBER", "LEADERSHIP", "ADMIN"], readBy: [] },
    { id: "n-3", at: iso("2026-09-07T09:00:00+05:30"), title: "CTRI renewal due in 21 days", body: "Demo registration CTRI/2026/DEMO/0261 renewal due 19 Oct 2026.", link: "/ethics", roles: ["PI", "LEADERSHIP", "ADMIN"], readBy: [] },
    { id: "n-4", at: iso("2026-09-23T09:00:00+05:30"), title: "Query overdue", body: "Q-101 (AYU-0003, Visit 2) passed its due date.", link: "/monitoring?tab=queries", roles: ["MONITOR", "COORDINATOR", "PI", "ADMIN"], readBy: [] },
    { id: "n-5", at: iso("2026-09-26T09:00:00+05:30"), title: "Expected visit missing", body: "Visit 2 is expected for AYU-0003 but no completed visit record exists.", link: "/participants/p-AYU-0003?tab=visits", roles: ["COORDINATOR", "PI", "MONITOR", "ADMIN"], readBy: [] },
    { id: "n-6", at: iso("2026-09-25T09:00:00+05:30"), title: "Safety follow-up due", body: "3 safety cases require follow-up or completeness review in the PV queue.", link: "/safety", roles: ["PV_OFFICER", "PI", "ADMIN"], readBy: [] },
  ];

  const a = (at: string, actor: string, role: AuditEntry["role"], entity: string, entityId: string, action: string, from: string | null, to: string | null, reason: string | null): AuditEntry => ({
    id: `aud-${entityId}-${action}-${at.slice(0, 10)}`, at: iso(at), actor, role, entity, entityId, action, from, to, reason,
  });

  const auditLogs: AuditEntry[] = [
    a("2026-09-27T09:00:00+05:30", "System (expiry check)", "ADMIN", "Ethics submission", "ec-026-c", "STATUS_EXPIRED", "APPROVED", "EXPIRED", "Approval validity ended 16 Sep 2026."),
    a("2026-09-22T15:00:00+05:30", "Dr. Arjun Rao (PI)", "PI", "Screening", "p-AYU-0025", "PI_REVIEW", "PENDING", "REVIEWED", "Eligibility confirmed against protocol v1.2."),
    a("2026-09-21T10:05:00+05:30", "Priya Nair (Coordinator)", "COORDINATOR", "Consent", "c-AYU-0025", "RECORD_CREATED", null, "PENDING", "ICF v1.2 provided in Hindi; comprehension discussion held."),
    a("2026-09-18T11:30:00+05:30", "Priya Nair (Coordinator)", "COORDINATOR", "Safety event", "se-001", "CREATED", null, "IDENTIFIED", "Hospitalisation reported by participant."),
    a("2026-09-18T11:30:00+05:30", "System (rule)", "ADMIN", "PV task", "pt-001", "CREATED", null, "FOLLOW_UP_DUE", "Rule: serious event → PV follow-up task due +3 days."),
    a("2026-09-16T10:00:00+05:30", "Vikram Desai (Monitor)", "MONITOR", "Monitoring finding", "mf-001", "CREATED", null, "OPEN", "Blank assessment score at V1."),
    a("2026-09-15T11:00:00+05:30", "Vikram Desai (Monitor)", "MONITOR", "Query", "q-101", "CREATED", null, "OPEN", "Visit 2 window elapsed."),
    a("2026-09-13T09:00:00+05:30", "Dr. Arjun Rao (PI)", "PI", "Safety event", "se-102", "PI_REVIEW", "PI_REVIEW_PENDING", "FOLLOW_UP", "Reviewed narrative; follow-up continues."),
    a("2026-09-12T09:00:00+05:30", "Priya Nair (Coordinator)", "COORDINATOR", "Query", "q-105", "RESPONDED", "OPEN", "RESPONDED", "Dispensing log checked."),
    a("2026-09-10T15:00:00+05:30", "Priya Nair (Coordinator)", "COORDINATOR", "Visit", "v-AYU-0005-V1", "COMPLETED", "SCHEDULED", "COMPLETED", "Visit conducted at site."),
    a("2026-08-30T12:00:00+05:30", "Dr. Meera Iyer (PV Officer)", "PV_OFFICER", "Safety event", "se-088", "CLOSED", "FOLLOW_UP", "CLOSED", "Completeness verified; outcome resolved."),
    a("2026-08-21T09:30:00+05:30", "Vikram Desai (Monitor)", "MONITOR", "Query", "q-095", "RESOLVED", "RESPONDED", "RESOLVED", "Verified against source."),
    a("2026-08-02T12:00:00+05:30", "Dr. Sanjay Kulkarni (Ethics Member)", "ETHICS_MEMBER", "Ethics submission", "ec-026-b", "APPROVED", "UNDER_REVIEW", "APPROVED", "Approved with administrative changes (demo decision)."),
    a("2026-05-12T12:00:00+05:30", "Dr. Sanjay Kulkarni (Ethics Member)", "ETHICS_MEMBER", "Ethics submission", "ec-026-a", "APPROVED", "UNDER_REVIEW", "APPROVED", "Initial approval for Site 1 (demo decision)."),
    a("2026-04-02T12:00:00+05:30", "Dr. Arjun Rao (PI)", "PI", "CTRI record", DEMO_TRIAL_ID, "REGISTERED", "REF", "REGISTERED", "Demo registration CTRI/2026/DEMO/0261 recorded."),
  ];

  return {
    meta: { version, seededAt: new Date().toISOString() },
    users, sites, trials,
    participants, screenings, consents, enrollments,
    visits, observations, labResults,
    safetyEvents, pvTasks,
    queries, findings,
    ethicsSubmissions,
    notifications, auditLogs,
    exportsLog: [],
    assistant: { dismissed: [], accepted: [] },
    judge: { startedAt: null, visited: [] },
  };
}

function vi9(visitId: string): number {
  return visitId.endsWith("V2") ? 2 : visitId.endsWith("V1") ? 1 : 0;
}
