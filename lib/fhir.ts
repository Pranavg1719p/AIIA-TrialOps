import { db } from "./store";
import { activeTrial } from "./kpi";

/**
 * FHIR R4 demo bundle — parseable JSON only.
 * Synthetic coded identities; no ABHA, no real identifiers, no transmission.
 */
export function buildFhirBundle() {
  const d = db();
  const trial = activeTrial();
  const enrolledIds = new Set(d.enrollments.filter((e) => e.trialId === trial.id).map((e) => e.participantId));
  const patients = d.participants.filter((p) => enrolledIds.has(p.id));
  const entries: { fullUrl: string; resource: Record<string, unknown> }[] = [];

  const push = (resource: Record<string, unknown>) =>
    entries.push({ fullUrl: `urn:uuid:aiia-demo-${String(resource.id)}`, resource });

  for (const p of patients) {
    push({
      resourceType: "Patient",
      id: p.code,
      meta: { tag: [{ code: "SYNTHETIC-DEMO" }] },
      identifier: [{ system: "urn:aiia:demo:subject-code", value: p.code }],
      active: true,
    });
    const consent = d.consents.filter((c) => c.participantId === p.id).slice(-1)[0];
    if (consent?.status === "ACCEPTED") {
      push({
        resourceType: "Consent",
        id: `consent-${p.code}`,
        meta: { tag: [{ code: "SYNTHETIC-DEMO" }] },
        status: "active",
        scope: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/consentscope", code: "research" }], text: "Research (demo)" },
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/consentcategorycodes", code: "research" }], text: consent.version }],
        patient: { reference: `Patient/${p.code}`, display: p.code },
        dateTime: consent.at,
        text: { status: "generated", div: `<div xmlns="http://www.w3.org/1999/xhtml">Simulated demo consent. Signature simulated — not a legally valid e-signature.</div>` },
      });
    }
    const enr = d.enrollments.find((e) => e.participantId === p.id);
    if (enr) {
      push({
        resourceType: "Encounter",
        id: `enc-${p.code}-enrollment`,
        meta: { tag: [{ code: "SYNTHETIC-DEMO" }] },
        status: "finished",
        class: { code: "AMB", display: "ambulatory (demo)" },
        subject: { reference: `Patient/${p.code}`, display: p.code },
        period: { start: enr.enrolledAt },
        extension: [{ url: "urn:aiia:demo:trial", valueString: trial.code }],
      });
    }
    for (const lab of d.labResults.filter((l) => l.participantId === p.id)) {
      push({
        resourceType: "Observation",
        id: `obs-${lab.id}`,
        meta: { tag: [{ code: "SYNTHETIC-DEMO" }] },
        status: lab.status === "FINAL" ? "final" : "preliminary",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory" }] }],
        code: { coding: [{ system: "urn:aiia:demo:test", code: lab.test }], text: `${lab.test} (demo mapping)` },
        subject: { reference: `Patient/${p.code}`, display: p.code },
        effectiveDateTime: lab.collectedAt,
        valueQuantity: { value: lab.value, unit: lab.unit },
        referenceRange: [{ low: { value: lab.refLow }, high: { value: lab.refHigh } }],
      });
    }
    for (const o of d.observations.filter((x) => x.participantId === p.id)) {
      if (o.fields.assessmentScore === null || o.fields.assessmentScore === undefined) continue;
      const visit = d.visits.find((v) => v.id === o.visitId);
      push({
        resourceType: "Observation",
        id: `obs-${o.id}`,
        meta: { tag: [{ code: "SYNTHETIC-DEMO" }] },
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "survey" }] }],
        code: { coding: [{ system: "urn:aiia:demo:crf", code: "protocol-assessment-score" }], text: "Protocol assessment score (demo CRF)" },
        subject: { reference: `Patient/${p.code}`, display: p.code },
        effectiveDateTime: o.createdAt,
        valueInteger: o.fields.assessmentScore as number,
        extension: visit ? [{ url: "urn:aiia:demo:visit", valueString: visit.type }] : [],
      });
    }
  }

  return {
    resourceType: "Bundle" as const,
    id: `aiia-demo-bundle-${trial.code}`,
    type: "collection",
    timestamp: new Date().toISOString(),
    meta: { tag: [{ code: "SYNTHETIC-DEMO-DATA" }] },
    entry: entries,
  };
}

export function fhirMappingNotes() {
  return [
    { resource: "Patient", source: "participants.code", note: "Coded subject identity only (AYU-####). No names, contact or ABHA identifiers are exported." },
    { resource: "Consent", source: "consents (latest ACCEPTED)", note: "Research-scope demo consent; signature is simulated." },
    { resource: "Encounter", source: "enrollments", note: "Enrollment encounter with trial extension." },
    { resource: "Observation", source: "lab_results", note: "Local demo test coding (urn:aiia:demo:test); LOINC mapping to be configured in production." },
    { resource: "Observation", source: "observations (assessment score)", note: "Protocol CRF numeric field only; no inferred Prakriti/Dosha/Agni concepts." },
  ];
}
