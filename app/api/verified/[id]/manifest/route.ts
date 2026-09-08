import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { verifiedRaffles } from "@/db/schema";
import {
  expandVerifiedEntries,
  publicAuditManifest,
  publicAuditManifestV2,
  publicAuditManifestV3,
  publicCommitmentManifest,
} from "@/lib/verified-raffle";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [raffle] = await getDb()
    .select()
    .from(verifiedRaffles)
    .where(eq(verifiedRaffles.id, id.toUpperCase()))
    .limit(1);
  if (!raffle)
    return Response.json(
      { error: "Verified raffle not found." },
      { status: 404 },
    );
  if (!raffle.receiptSeed || !raffle.publicManifestHash)
    return Response.json(
      {
        error: "This legacy raffle does not have a public commitment manifest.",
      },
      { status: 404 },
    );
  const expanded = expandVerifiedEntries(
    raffle.entriesText,
    String(raffle.firstTicket),
  );
  if (expanded.error)
    return Response.json(
      { error: "Locked manifest could not be reconstructed." },
      { status: 500 },
    );
  const csv = raffle.auditVersion >= 4
    ? await publicAuditManifest(expanded.tickets, raffle.receiptSeed)
    : raffle.auditVersion >= 3
      ? await publicAuditManifestV3(expanded.tickets, raffle.receiptSeed)
    : raffle.auditVersion >= 2
      ? await publicAuditManifestV2(expanded.tickets, raffle.receiptSeed)
    : await publicCommitmentManifest(expanded.tickets, raffle.receiptSeed);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${raffle.id.toLowerCase()}-public-audit-ledger.csv"`,
      "x-raffle-manifest-sha256": raffle.publicManifestHash,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
