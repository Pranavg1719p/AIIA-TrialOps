import { NextResponse } from "next/server";
import { requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { route } from "@/lib/api";
import { buildFhirBundle } from "@/lib/fhir";
import { nid, nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = requirePerm("export.create", "Exports are restricted to Coordinator / PI / Admin roles.");
  const bundle = buildFhirBundle();

  db().exportsLog.push({ id: nid("exp"), at: nowIso(), by: user.name, role: user.role, kind: "FHIR_R4_BUNDLE" });
  logAudit({ actor: user.name, role: user.role, entity: "Export", entityId: bundle.id, action: "FHIR_EXPORT", to: "DOWNLOADED", reason: "FHIR R4 demo bundle (synthetic coded identities; no external transmission)" });
  await persist();

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/fhir+json; charset=utf-8",
      "content-disposition": `attachment; filename="aiia-demo-fhir-bundle.json"`,
      "x-demo-disclaimer": "SYNTHETIC DEMO DATA - NOT FOR CLINICAL USE",
    },
  });
});
