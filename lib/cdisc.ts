import { db } from "./store";
import { activeTrial } from "./kpi";

export const CDISC_LABEL = "Sample mapping demonstration — not validated SDTM/ADaM/Define-XML.";

function csv(rows: (string | number | null)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = c === null || c === undefined ? "" : String(c);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(",")
    )
    .join("\r\n");
}

export interface CdiscException {
  dataset: string;
  detail: string;
}

export function cdiscExceptions(): CdiscException[] {
  const d = db();
  const trial = activeTrial();
  const out: CdiscException[] = [];
  const pendingLabs = d.labResults.filter((l) => l.status === "PENDING").length;
  if (pendingLabs)
    out.push({ dataset: "VS-like.csv", detail: `${pendingLabs} result(s) with status PENDING exported with VSSTAT=PENDING; source value preserved.` });
  const ongoingAe = d.safetyEvents.filter((s) => s.trialId === trial.id && /ongoing|under treatment/i.test(s.outcome)).length;
  if (ongoingAe)
    out.push({ dataset: "AE-like.csv", detail: `${ongoingAe} event(s) still ongoing — AEENDDTC left blank and flagged in mapping notes.` });
  out.push({ dataset: "AE-like.csv", detail: "AEREL (causality) intentionally left blank — the system never infers causality; pending PI assessment." });
  out.push({ dataset: "DM-like.csv", detail: "Demographics limited to coded subject ID and site; no age/sex/name exported from this demo system." });
  return out;
}

export function dmLike(): string {
  const d = db();
  const trial = activeTrial();
  const rows: (string | number | null)[][] = [
    ["STUDYID", "DOMAIN", "USUBJID", "SUBJID", "SITEID", "ARM", "RFSTDTC", "RFENDTC", "ENRLSTATUS"],
  ];
  for (const e of d.enrollments.filter((x) => x.trialId === trial.id)) {
    const p = d.participants.find((x) => x.id === e.participantId)!;
    const site = d.sites.find((s) => s.id === e.siteId)!;
    rows.push([trial.code, "DM", `${trial.code}.${p.code}`, p.code, site.code, trial.intervention, e.enrolledAt.slice(0, 10), null, "ENROLLED"]);
  }
  return csv(rows);
}

export function vsLike(): string {
  const d = db();
  const trial = activeTrial();
  const rows: (string | number | null)[][] = [
    ["STUDYID", "DOMAIN", "USUBJID", "VSTESTCD", "VSTEST", "VSORRES", "VSORRESU", "VSSTNRLO", "VSSTNRHI", "VSSTAT", "VSDTC"],
  ];
  for (const l of d.labResults) {
    const p = d.participants.find((x) => x.id === l.participantId);
    if (!p || p.trialId !== trial.id) continue;
    rows.push([
      trial.code, "VS", `${trial.code}.${p.code}`, l.test.replace(/[^A-Za-z]/g, "").slice(0, 8).toUpperCase(),
      l.test, l.value, l.unit, l.refLow, l.refHigh, l.status, l.collectedAt.slice(0, 10),
    ]);
  }
  return csv(rows);
}

export function aeLike(): string {
  const d = db();
  const trial = activeTrial();
  const rows: (string | number | null)[][] = [
    ["STUDYID", "DOMAIN", "USUBJID", "AETERM", "AESTDTC", "AEENDTC", "AESER", "AESEV", "AEREL", "AEOUT"],
  ];
  for (const s of d.safetyEvents.filter((x) => x.trialId === trial.id)) {
    const p = d.participants.find((x) => x.id === s.participantId)!;
    const ongoing = /ongoing|under treatment/i.test(s.outcome);
    rows.push([
      trial.code, "AE", `${trial.code}.${p.code}`, s.term, s.onsetAt.slice(0, 10),
      ongoing || !s.outcome ? null : s.createdAt.slice(0, 10),
      s.seriousness === "SERIOUS" ? "Y" : "N", s.severity, null,
      s.outcome || "NOT REPORTED",
    ]);
  }
  return csv(rows);
}

export function mappingDictionary(): string {
  const rows: string[][] = [
    ["TARGET_COLUMN", "SOURCE_FIELD", "SOURCE_TABLE", "TRANSFORM", "NOTES"],
    ["DM.USUBJID", "code", "participants", "STUDYID.code concatenation", "Coded synthetic identity"],
    ["DM.RFSTDTC", "enrolledAt", "enrollments", "ISO date part", ""],
    ["VS.VSORRES", "value", "lab_results", "as-is", "Source values preserved"],
    ["VS.VSSTAT", "status", "lab_results", "FINAL/ PENDING", "PENDING flagged as validation exception"],
    ["AE.AESER", "seriousness", "safety_events", "SERIOUS→Y else N", "Human-recorded seriousness only"],
    ["AE.AEREL", "—", "—", "not exported", "Causality never inferred by the system"],
    ["AE.AEENDTC", "outcome", "safety_events", "blank while ongoing", "Exception listed on Reports page"],
  ];
  return csv(rows);
}
