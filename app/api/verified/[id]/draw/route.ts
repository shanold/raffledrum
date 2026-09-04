import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { verifiedRaffles } from "@/db/schema";
import { deterministicIndex,expandVerifiedEntries,hexToBytes,manifestHash,maskName,sha256Hex } from "@/lib/verified-raffle";
import { requireOrganizer } from "@/lib/organizer-auth";
import { fetchQuicknetRound } from "@/lib/drand";
import { publicDraw,raffleDraws,type VerifiedDraw } from "@/lib/verified-history";

export const dynamic="force-dynamic";

export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const unauthorized=await requireOrganizer(request);if(unauthorized)return unauthorized;
  try{
    const {id}=await params,secret=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
    const db=getDb(),[raffle]=await db.select().from(verifiedRaffles).where(eq(verifiedRaffles.id,id.toUpperCase())).limit(1);
    if(!raffle)return Response.json({error:"Verified raffle not found."},{status:404});
    if(!secret||await sha256Hex(secret)!==raffle.hostSecretHash)return Response.json({error:"Organizer authorization failed."},{status:403});
    const draws=raffleDraws(raffle);
    if(draws.at(-1)?.targetRound===raffle.targetRound){
      const latest=await fetchQuicknetRound("latest");
      if(latest.kind!=="ready")return Response.json({error:"The next public randomness round could not be committed yet."},{status:503});
      await db.update(verifiedRaffles).set({targetRound:latest.round.round+5,status:"locked"}).where(eq(verifiedRaffles.id,raffle.id));
      return Response.json({error:"The next public randomness round is now committed."},{status:409});
    }
    const beaconResult=await fetchQuicknetRound(raffle.targetRound);
    if(beaconResult.kind==="not-ready")return Response.json({error:"The committed public randomness round is not available yet."},{status:409});
    if(beaconResult.kind==="unavailable")return Response.json({error:"The public randomness service is temporarily unavailable. The raffle remains safely locked; please try again."},{status:503});
    const beacon=beaconResult.round;
    if(beacon.round!==raffle.targetRound||!beacon.signature)throw new Error("Invalid public randomness response.");
    const randomness=beacon.randomness??await sha256Hex(hexToBytes(beacon.signature));
    const expanded=expandVerifiedEntries(raffle.entriesText,String(raffle.firstTicket));
    if(expanded.error||expanded.tickets.length!==raffle.ticketCount)throw new Error("Locked manifest could not be reconstructed.");
    const removed=new Set(draws.filter(draw=>draw.removed).map(draw=>draw.winnerNumber)),eligible=expanded.tickets.filter(ticket=>!removed.has(ticket.number));
    if(!eligible.length)return Response.json({error:"Every ticket has been removed from this raffle."},{status:409});
    const candidateHash=await manifestHash(eligible),winnerIndex=await deterministicIndex(candidateHash,beacon.round,randomness,eligible.length),winner=eligible[winnerIndex],drawnAt=new Date().toISOString(),winnerMasked=maskName(winner.name);
    const draw:VerifiedDraw={sequence:draws.length+1,ticketCount:eligible.length,manifestHash:candidateHash,targetRound:beacon.round,drandRandomness:randomness,drandSignature:beacon.signature,winnerName:winner.name,winnerMasked,winnerNumber:winner.number,winnerIndex,drawnAt,removed:false},next=[...draws,draw];
    await db.update(verifiedRaffles).set({status:"drawn",drawHistory:JSON.stringify(next),drandRandomness:randomness,drandSignature:beacon.signature,winnerName:winner.name,winnerMasked,winnerNumber:winner.number,winnerIndex,drawnAt}).where(eq(verifiedRaffles.id,raffle.id));
    return Response.json({raffle:{id:raffle.id,status:"drawn",ticketCount:raffle.ticketCount,remainingTickets:eligible.length,manifestHash:raffle.manifestHash,targetRound:raffle.targetRound,lockedAt:raffle.lockedAt,draws:next.map(publicDraw),winner:winner.name,winnerMasked,winnerNumber:winner.number,winnerIndex,drandRandomness:randomness,drandSignature:beacon.signature}});
  }catch(error){
    console.error("verified raffle draw failed",error);
    return Response.json({error:"The verified drawing could not be completed."},{status:500});
  }
}
