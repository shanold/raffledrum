import { getDb } from "@/db";
import { displaySessions } from "@/db/schema";
import { requireOrganizer } from "@/lib/organizer-auth";
import { randomToken, sha256Hex } from "@/lib/verified-raffle";

export const dynamic = "force-dynamic";
const lifetimeMs = 12 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const unauthorized = await requireOrganizer(request);
  if (unauthorized) return unauthorized;
  try {
    const body = (await request.json()) as { state?: unknown },
      stateJson = JSON.stringify(body.state ?? null);
    if (stateJson.length > 100_000)
      return Response.json({ error: "Display state is too large." }, { status: 400 });
    const id = randomToken(9).slice(0, 12).toUpperCase(),
      controlKey = randomToken(32),
      now = new Date(),
      expiresAt = new Date(now.getTime() + lifetimeMs);
    await getDb().insert(displaySessions).values({
      id,
      controlKeyHash: await sha256Hex(controlKey),
      stateJson,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });
    return Response.json({ id, controlKey, expiresAt: expiresAt.toISOString() }, { status: 201 });
  } catch (error) {
    console.error("display session creation failed", error);
    return Response.json({ error: "The public display session could not be created." }, { status: 500 });
  }
}
