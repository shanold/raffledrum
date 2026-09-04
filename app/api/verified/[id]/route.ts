import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { verifiedRaffles } from "@/db/schema";
import { expandVerifiedEntries,maskName } from "@/lib/verified-raffle";

export const dynamic="force-dynamic";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const [raffle]=await getDb().select().from(verifiedRaffles).where(eq(verifiedRaffles.id,id.toUpperCase())).limit(1);
  if(!raffle)return Response.json({error:"Verified raffle not found."},{status:404});
  const url=new URL(request.url),ticketText=url.searchParams.get("ticket");
  let ticket:null|{number:number;name:string}=null;
  if(ticketText){
    const number=Number(ticketText.replaceAll(",",""));
    if(Number.isSafeInteger(number)&&number>0){
      const expanded=expandVerifiedEntries(raffle.entriesText,String(raffle.firstTicket));
      const found=expanded.tickets.find(item=>item.number===number);
      if(found)ticket={number:found.number,name:maskName(found.name)};
    }
  }
  return Response.json({raffle:{id:raffle.id,status:raffle.status,ticketCount:raffle.ticketCount,manifestHash:raffle.manifestHash,targetRound:raffle.targetRound,lockedAt:raffle.lockedAt,drawnAt:raffle.drawnAt,winner:raffle.winnerMasked,winnerNumber:raffle.winnerNumber,winnerIndex:raffle.winnerIndex,drandRandomness:raffle.drandRandomness,drandSignature:raffle.drandSignature},ticket});
}
