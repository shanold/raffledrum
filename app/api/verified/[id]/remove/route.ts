import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { verifiedRaffles } from "@/db/schema";
import { requireOrganizer } from "@/lib/organizer-auth";
import { sha256Hex } from "@/lib/verified-raffle";
import { publicDraw,raffleDraws } from "@/lib/verified-history";

export const dynamic="force-dynamic";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 const unauthorized=await requireOrganizer(request);if(unauthorized)return unauthorized;
 const {id}=await params,secret=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"",db=getDb(),[raffle]=await db.select().from(verifiedRaffles).where(eq(verifiedRaffles.id,id.toUpperCase())).limit(1);
 if(!raffle)return Response.json({error:"Verified raffle not found."},{status:404});
 if(!secret||await sha256Hex(secret)!==raffle.hostSecretHash)return Response.json({error:"Organizer authorization failed."},{status:403});
 const draws=raffleDraws(raffle),latest=draws.at(-1);if(!latest)return Response.json({error:"There is no winning ticket to remove."},{status:409});
 latest.removed=true;await db.update(verifiedRaffles).set({drawHistory:JSON.stringify(draws)}).where(eq(verifiedRaffles.id,raffle.id));
 return Response.json({draws:draws.map(publicDraw),removedTicket:latest.winnerNumber});
}
