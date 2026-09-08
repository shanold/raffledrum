import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { displaySessions } from "@/db/schema";
import { sha256Hex } from "@/lib/verified-raffle";

export const dynamic = "force-dynamic";
const lifetimeMs = 12 * 60 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params,
    db = getDb(),
    [session] = await db.select().from(displaySessions).where(eq(displaySessions.id, id.toUpperCase())).limit(1);
  if (!session)
    return Response.json({ error: "Public display session not found." }, { status: 404 });
  if (Date.parse(session.expiresAt) <= Date.now())
    return Response.json({ error: "This public display link has expired." }, { status: 410 });
  return Response.json({
    state: JSON.parse(session.stateJson),
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
  }, { headers: { "cache-control": "no-store" } });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params,
    controlKey = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "",
    db = getDb(),
    [session] = await db.select().from(displaySessions).where(eq(displaySessions.id, id.toUpperCase())).limit(1);
  if (!session)
    return Response.json({ error: "Public display session not found." }, { status: 404 });
  if (Date.parse(session.expiresAt) <= Date.now())
    return Response.json({ error: "This public display link has expired." }, { status: 410 });
  if (!controlKey || (await sha256Hex(controlKey)) !== session.controlKeyHash)
    return Response.json({ error: "Display control key was rejected." }, { status: 403 });
  const body = (await request.json()) as { state?: unknown },
    stateJson = JSON.stringify(body.state ?? null);
  if (stateJson.length > 100_000)
    return Response.json({ error: "Display state is too large." }, { status: 400 });
  const now = new Date(),
    expiresAt = new Date(now.getTime() + lifetimeMs);
  await db.update(displaySessions).set({
    stateJson,
    updatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }).where(eq(displaySessions.id, session.id));
  return Response.json({ ok: true, expiresAt: expiresAt.toISOString() });
}
