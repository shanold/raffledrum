import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { verifiedRaffles } from "@/db/schema";
import { requireOrganizer } from "@/lib/organizer-auth";
import {
  expandVerifiedEntries,
  sha256Hex,
  ticketCommitment,
  ticketReceiptCode,
} from "@/lib/verified-raffle";

export const dynamic = "force-dynamic";
const csv = (value: string | number) =>
  `"${String(value).replaceAll('"', '""')}"`;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const unauthorized = await requireOrganizer(request);
  if (unauthorized) return unauthorized;
  const { id } = await params,
    secret =
      request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
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
  if (!secret || (await sha256Hex(secret)) !== raffle.hostSecretHash)
    return Response.json(
      { error: "Organizer authorization failed." },
      { status: 403 },
    );
  if (!raffle.receiptSeed)
    return Response.json(
      { error: "This legacy raffle does not have private receipt codes." },
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
  const rows = ["Name,Ticket,VerificationCode,Commitment"];
  for (let start = 0; start < expanded.tickets.length; start += 500) {
    rows.push(
      ...(await Promise.all(
        expanded.tickets.slice(start, start + 500).map(async (ticket) => {
          const code = await ticketReceiptCode(raffle.receiptSeed!, ticket);
          return [
            csv(ticket.name),
            ticket.number,
            code,
            await ticketCommitment(ticket, code),
          ].join(",");
        }),
      )),
    );
  }
  return new Response(`${rows.join("\n")}\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${raffle.id.toLowerCase()}-private-receipts.csv"`,
      "cache-control": "no-store",
    },
  });
}
