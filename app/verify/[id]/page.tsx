"use client";

import { useEffect,useState } from "react";
import { useParams } from "next/navigation";
import { ExternalLink,Search,ShieldCheck } from "lucide-react";
import { deterministicIndex } from "@/lib/verified-raffle";

type PublicDraw={sequence:number;ticketCount:number;manifestHash:string;targetRound:number;drandRandomness:string;drandSignature:string;winnerMasked:string;winnerNumber:number;winnerIndex:number;drawnAt:string;removed:boolean};
type PublicRaffle={id:string;status:"locked"|"drawn";ticketCount:number;manifestHash:string;targetRound:number;lockedAt:string;draws:PublicDraw[]};

export default function VerifyRaffle(){
 const params=useParams<{id:string}>(),id=String(params.id??"").toUpperCase();
 const [raffle,setRaffle]=useState<PublicRaffle|null>(null),[error,setError]=useState(""),[ticket,setTicket]=useState(""),[ticketResult,setTicketResult]=useState<{number:number;name:string}|null|undefined>(undefined),[checking,setChecking]=useState(false),[mathVerified,setMathVerified]=useState(false);
 const latest=raffle?.draws.at(-1);
 useEffect(()=>{void fetch(`/api/verified/${encodeURIComponent(id)}`).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error??"Raffle not found.");setRaffle(data.raffle)}).catch(reason=>setError(reason instanceof Error?reason.message:"Raffle not found."))},[id]);
 useEffect(()=>{if(!latest)return;void deterministicIndex(latest.manifestHash,latest.targetRound,latest.drandRandomness,latest.ticketCount).then(index=>setMathVerified(index===latest.winnerIndex))},[latest]);
 const checkTicket=async()=>{setChecking(true);try{const response=await fetch(`/api/verified/${encodeURIComponent(id)}?ticket=${encodeURIComponent(ticket)}`),data=await response.json();if(!response.ok)throw new Error(data.error);setTicketResult(data.ticket??null)}catch(reason){setError(reason instanceof Error?reason.message:"Ticket lookup failed.")}finally{setChecking(false)}};
 if(error)return <main className="verify-shell"><section className="verify-card"><h1>Couldn&apos;t verify raffle</h1><p>{error}</p></section></main>;
 if(!raffle)return <main className="verify-shell"><section className="verify-card"><p>Loading verified raffle…</p></section></main>;
 return <main className="verify-shell">
  <section className="verify-card">
   <div className="verify-brand"><ShieldCheck/><div><p>PUBLIC AUDIT</p><h1>{raffle.id}</h1></div></div>
   <div className={raffle.status==="drawn"?"public-status drawn":"public-status"}><span/>{raffle.status==="drawn"?"Drawing complete and reproducible":"Ticket list locked"}</div>
   {latest?<><div className="public-winner"><small>VERIFIED WINNER #{latest.sequence}</small><strong>{latest.winnerMasked}</strong><b>Ticket #{latest.winnerNumber.toLocaleString()}</b></div>{raffle.draws.length>1&&<ol>{[...raffle.draws].reverse().map(draw=><li key={draw.sequence}>Draw {draw.sequence}: {draw.winnerMasked} — Ticket #{draw.winnerNumber.toLocaleString()}{draw.removed?" (removed from later draws)":""}</li>)}</ol>}</>:<div className="locked-message"><strong>The result is not known yet.</strong><p>The app committed to public randomness round #{raffle.targetRound.toLocaleString()} before that value existed.</p></div>}
   <div className="public-facts"><div><span>Original locked tickets</span><strong>{raffle.ticketCount.toLocaleString()}</strong></div><div><span>Locked at</span><strong>{new Date(raffle.lockedAt).toLocaleString()}</strong></div><div className="wide"><span>Original list fingerprint</span><code>{raffle.manifestHash}</code></div>{latest&&<><div><span>Latest beacon round</span><strong>#{latest.targetRound.toLocaleString()}</strong></div><div><span>Latest math check</span><strong className={mathVerified?"pass":""}>{mathVerified?"Passed":"Checking…"}</strong></div><div className="wide"><span>Latest public randomness</span><code>{latest.drandRandomness}</code></div></>}</div>
   <section className="ticket-check"><h2>Check a ticket</h2><p>Enter an exact ticket number. Names are partially masked for privacy.</p><div><input inputMode="numeric" value={ticket} onChange={event=>setTicket(event.target.value)} onKeyDown={event=>{if(event.key==="Enter")void checkTicket()}} placeholder="45,583"/><button onClick={()=>{void checkTicket()}} disabled={checking||!ticket.trim()}><Search/>{checking?"Checking":"Check"}</button></div>{ticketResult===null&&<p className="ticket-miss">That ticket number is not in this locked raffle.</p>}{ticketResult&&<p className="ticket-hit"><ShieldCheck/>Ticket #{ticketResult.number.toLocaleString()} belongs to <strong>{ticketResult.name}</strong></p>}</section>
   <a className="drand-link" href={`https://api.drand.sh/v2/beacons/quicknet/rounds/${latest?.targetRound??raffle.targetRound}`} target="_blank" rel="noreferrer">View the independent public beacon record <ExternalLink/></a>
  </section>
 </main>
}
