export type VerifiedTicket={name:string;number:number};
export const VERIFIED_MAX_TICKETS=100000;

function parsePositiveInteger(value:string){
  const text=value.trim();
  if(!/^\d+$/.test(text)&&!/^\d{1,3}(,\d{3})+$/.test(text))return null;
  const number=Number(text.replaceAll(",",""));
  return Number.isSafeInteger(number)&&number>0?number:null;
}

export function expandVerifiedEntries(value:string,firstTicketText:string){
  const firstTicket=parsePositiveInteger(firstTicketText);
  if(!firstTicket)return{tickets:[] as VerifiedTicket[],error:"Enter a valid first automatic ticket number."};
  const specs:{name:string;count:number;start?:number;end?:number}[]=[];
  for(const raw of value.split(/\r?\n/)){
    const entry=raw.trim();
    if(!entry)continue;
    const manual=entry.match(/^(.+?)\s+#\s*([\d,]+)\s*[-–]\s*([\d,]+)$/);
    const weighted=entry.match(/^(.+?)\s+[×x]\s*([\d,]+)$/i);
    if(manual){
      const start=parsePositiveInteger(manual[2]),end=parsePositiveInteger(manual[3]);
      if(!start||!end||end<start)return{tickets:[] as VerifiedTicket[],error:`“${entry}” has an invalid ticket range.`};
      specs.push({name:manual[1].trim(),count:end-start+1,start,end});
    }else if(weighted){
      const count=parsePositiveInteger(weighted[2]);
      if(!count)return{tickets:[] as VerifiedTicket[],error:`“${weighted[2]}” is not a valid ticket count.`};
      specs.push({name:weighted[1].trim(),count});
    }else if(/\s[×x]\s|\s#\s/.test(entry)){
      return{tickets:[] as VerifiedTicket[],error:`“${entry}” is not formatted correctly.`};
    }else specs.push({name:entry,count:1});
  }
  const total=specs.reduce((sum,s)=>sum+s.count,0);
  if(!total)return{tickets:[] as VerifiedTicket[],error:"Add at least one ticket first."};
  if(total>VERIFIED_MAX_TICKETS)return{tickets:[] as VerifiedTicket[],error:`Verified drawings currently support up to ${VERIFIED_MAX_TICKETS.toLocaleString()} tickets.`};
  const tickets:VerifiedTicket[]=[],used=new Set<number>();
  for(const spec of specs.filter(s=>s.start!==undefined)){
    for(let number=spec.start!;number<=spec.end!;number++){
      if(used.has(number))return{tickets:[] as VerifiedTicket[],error:`Ticket #${number.toLocaleString()} is assigned more than once.`};
      used.add(number);tickets.push({name:spec.name,number});
    }
  }
  let next=firstTicket;
  for(const spec of specs.filter(s=>s.start===undefined)){
    for(let i=0;i<spec.count;i++){while(used.has(next))next++;used.add(next);tickets.push({name:spec.name,number:next++})}
  }
  return{tickets,error:null};
}

export function maskName(name:string){
  const parts=name.trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return "";
  return [parts[0],...parts.slice(1).map(part=>part[0]?.toUpperCase()).filter(Boolean)].join(" ");
}

export async function sha256Hex(value:string|Uint8Array){
  const bytes=typeof value==="string"?new TextEncoder().encode(value):value;
  const digest=await crypto.subtle.digest("SHA-256",new Uint8Array(bytes).buffer);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

export async function manifestHash(tickets:VerifiedTicket[]){
  return sha256Hex(tickets.map(ticket=>`${ticket.number}\t${ticket.name.normalize("NFC")}\n`).join(""));
}

export function randomToken(bytes=24){
  const value=new Uint8Array(bytes);crypto.getRandomValues(value);
  return btoa(String.fromCharCode(...value)).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
}

export async function deterministicIndex(manifest:string,round:number,randomness:string,count:number){
  for(let counter=0;;counter++){
    const hex=await sha256Hex(`raffle-drum-v1|${manifest}|${round}|${randomness}|${counter}`);
    const value=Number.parseInt(hex.slice(0,12),16),range=281474976710656,limit=range-(range%count);
    if(value<limit)return value%count;
  }
}

export function hexToBytes(hex:string){
  if(!/^[0-9a-f]+$/i.test(hex)||hex.length%2)throw new Error("Invalid hexadecimal value.");
  return new Uint8Array(hex.match(/../g)!.map(part=>Number.parseInt(part,16)));
}
