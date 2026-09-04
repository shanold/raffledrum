import { getDb } from "@/db";
import { verifiedRaffles } from "@/db/schema";
import { expandVerifiedEntries,manifestHash,randomToken,sha256Hex } from "@/lib/verified-raffle";
import { requireOrganizer } from "@/lib/organizer-auth";
import { fetchQuicknetRound } from "@/lib/drand";

export const dynamic="force-dynamic";

export async function POST(request:Request){
  const unauthorized=await requireOrganizer(request);if(unauthorized)return unauthorized;
  try{
    const payload=await request.json() as {entries?:string;firstTicket?:string};
    const entries=payload.entries?.trim()??"",firstTicket=payload.firstTicket?.trim()??"";
    const expanded=expandVerifiedEntries(entries,firstTicket);
    if(expanded.error)return Response.json({error:expanded.error},{status:400});
    const beacon=await fetchQuicknetRound("latest");
    if(beacon.kind!=="ready")return Response.json({error:"The public randomness service is temporarily unavailable. Nothing was locked."},{status:503});
    const latest=beacon.round;
    const id=`RF-${randomToken(6).slice(0,8).toUpperCase()}`,hostSecret=randomToken(32),now=new Date().toISOString();
    const hash=await manifestHash(expanded.tickets);
    await getDb().insert(verifiedRaffles).values({id,hostSecretHash:await sha256Hex(hostSecret),status:"locked",entriesText:entries,firstTicket:Number(firstTicket.replaceAll(",","")),ticketCount:expanded.tickets.length,manifestHash:hash,targetRound:latest.round!+5,createdAt:now,lockedAt:now});
    return Response.json({raffle:{id,status:"locked",ticketCount:expanded.tickets.length,manifestHash:hash,targetRound:latest.round!+5,lockedAt:now},hostSecret},{status:201});
  }catch(error){
    console.error("verified raffle lock failed",error);
    return Response.json({error:"The raffle could not be locked. Please try again."},{status:500});
  }
}
