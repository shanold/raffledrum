import type { verifiedRaffles } from "@/db/schema";
import { maskName } from "@/lib/verified-raffle";

export type VerifiedDraw={sequence:number;ticketCount:number;manifestHash:string;targetRound:number;drandRandomness:string;drandSignature:string;winnerName:string;winnerMasked:string;winnerNumber:number;winnerIndex:number;drawnAt:string;removed:boolean};

export function raffleDraws(raffle:typeof verifiedRaffles.$inferSelect):VerifiedDraw[]{
  try{const parsed=JSON.parse(raffle.drawHistory??"[]");if(Array.isArray(parsed)&&parsed.length)return parsed as VerifiedDraw[]}catch{}
  if(raffle.winnerNumber!==null&&raffle.winnerIndex!==null&&raffle.drandRandomness&&raffle.drandSignature&&raffle.winnerName&&raffle.winnerMasked&&raffle.drawnAt)return[{sequence:1,ticketCount:raffle.ticketCount,manifestHash:raffle.manifestHash,targetRound:raffle.targetRound,drandRandomness:raffle.drandRandomness,drandSignature:raffle.drandSignature,winnerName:raffle.winnerName,winnerMasked:raffle.winnerMasked,winnerNumber:raffle.winnerNumber,winnerIndex:raffle.winnerIndex,drawnAt:raffle.drawnAt,removed:false}];
  return[];
}

export function publicDraw(draw:VerifiedDraw){const{winnerName,...safe}=draw;return{...safe,winnerMasked:maskName(winnerName)}}
