import { NextRequest, NextResponse } from "next/server";
import { requirePerm } from "@/lib/auth";
import { db, persist } from "@/lib/store";
import { logAudit } from "@/lib/audit";
import { errValidation } from "@/lib/errors";
import { route } from "@/lib/api";
import { CDISC_LABEL, aeLike, dmLike, mappingDictionary, vsLike } from "@/lib/cdisc";
import { nid, nowIso } from "@/lib/util";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const user = requirePerm("export.create", "Exports are restricted to Coordinator / PI / Admin roles.");
  const dataset = req.nextUrl.searchParams.get("dataset") ?? "DM";
  const map: Record<string, () => string> = {
    DM: dmLike, VS: vsLike, AE: aeLike, mapping: mappingDictionary,
  };
  const build = map[dataset];
  if (!build) throw errValidation("Unknown dataset. Use DM, VS, AE or mapping.");

  const filenames: Record<string, string> = { DM: "DM-like.csv", VS: "VS-like.csv", AE: "AE-like.csv", mapping: "mapping_dictionary.csv" };
  const filename = filenames[dataset];
  const header = dataset === "mapping" ? "" : `\r\n`;

  db().exportsLog.push({ id: nid("exp"), at: nowIso(), by: user.name, role: user.role, kind: `CDISC_${dataset}` });
  logAudit({ actor: user.name, role: user.role, entity: "Export", entityId: filename, action: "CDISC_EXPORT", to: "DOWNLOADED", reason: "Sample mapping demonstration — not validated SDTM/ADaM/Define-XML. Source values preserved." });
  await persist();

  const csv = `${CDISC_LABEL}\r\n${header}${build()}`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "x-demo-disclaimer": "SAMPLE MAPPING DEMONSTRATION - NOT VALIDATED SDTM/ADaM/Define-XML",
    },
  });
});
