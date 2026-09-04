import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { verifiedRaffles } from "@/db/schema";
import { deterministicIndex,expandVerifiedEntries,hexToBytes,maskName,sha256Hex } from "@/lib/verified-raffle";
import { requireOrganizer } from "@/lib/organizer-auth";
import { fetchQuicknetRound } from "@/lib/drand";

export const dynamic="force-dynamic";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const unauthorized=await requireOrganizer(request);if(unauthorized)return unauthorized;
  try{
    const {id}=await params,secret=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
    const db=getDb(),[raffle]=await db.select().from(verifiedRaffles).where(eq(verifiedRaffles.id,id.toUpperCase())).limit(1);
    if(!raffle)return Response.json({error:"Verified raffle not found."},{status:404});
    if(!secret||await sha256Hex(secret)!==raffle.hostSecretHash)return Response.json({error:"Organizer authorization failed."},{status:403});
    if(raffle.status==="drawn")return Response.json({raffle:{...publicResult(raffle),winner:raffle.winnerName}});
    const beaconResult=await fetchQuicknetRound(raffle.targetRound);
    if(beaconResult.kind==="not-ready")return Response.json({error:"The committed public randomness round is not available yet."},{status:409});
    if(beaconResult.kind==="unavailable")return Response.json({error:"The public randomness service is temporarily unavailable. The raffle remains safely locked; please try again."},{status:503});
    const beacon=beaconResult.round;
    if(beacon.round!==raffle.targetRound||!beacon.signature)throw new Error("Invalid public randomness response.");
    const randomness=beacon.randomness??await sha256Hex(hexToBytes(beacon.signature));
    const expanded=expandVerifiedEntries(raffle.entriesText,String(raffle.firstTicket));
    if(expanded.error||expanded.tickets.length!==raffle.ticketCount)throw new Error("Locked manifest could not be reconstructed.");
    const winnerIndex=await deterministicIndex(raffle.manifestHash,beacon.round,randomness,expanded.tickets.length),winner=expanded.tickets[winnerIndex],drawnAt=new Date().toISOString(),winnerMasked=maskName(winner.name);
    await db.update(verifiedRaffles).set({status:"drawn",drandRandomness:randomness,drandSignature:beacon.signature,winnerName:winner.name,winnerMasked,winnerNumber:winner.number,winnerIndex,drawnAt}).where(eq(verifiedRaffles.id,raffle.id));
    return Response.json({raffle:{id:raffle.id,status:"drawn",ticketCount:raffle.ticketCount,manifestHash:raffle.manifestHash,targetRound:raffle.targetRound,lockedAt:raffle.lockedAt,drawnAt,winner:winner.name,winnerMasked,winnerNumber:winner.number,winnerIndex,drandRandomness:randomness,drandSignature:beacon.signature}});
  }catch(error){
    console.error("verified raffle draw failed",error);
    return Response.json({error:"The verified drawing could not be completed."},{status:500});
  }
}

function publicResult(raffle:typeof verifiedRaffles.$inferSelect){
  return{id:raffle.id,status:raffle.status,ticketCount:raffle.ticketCount,manifestHash:raffle.manifestHash,targetRound:raffle.targetRound,lockedAt:raffle.lockedAt,drawnAt:raffle.drawnAt,winnerMasked:raffle.winnerMasked,winnerNumber:raffle.winnerNumber,winnerIndex:raffle.winnerIndex,drandRandomness:raffle.drandRandomness,drandSignature:raffle.drandSignature};
}
