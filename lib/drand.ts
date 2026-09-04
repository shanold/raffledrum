const QUICKNET_RELAYS=["https://api.drand.sh","https://api2.drand.sh","https://api3.drand.sh"];

export type DrandRound={round:number;signature:string;randomness?:string};
export type DrandResult={kind:"ready";round:DrandRound}|{kind:"not-ready"}|{kind:"unavailable"};

export async function fetchQuicknetRound(round:number|"latest"):Promise<DrandResult>{
  let sawNotReady=false;
  for(const relay of QUICKNET_RELAYS){
    try{
      const response=await fetch(`${relay}/v2/beacons/quicknet/rounds/${round}`,{headers:{accept:"application/json"},cache:"no-store"});
      if(response.status===400||response.status===404||response.status===425){sawNotReady=true;continue}
      if(!response.ok){console.warn("drand relay returned an error",{relay,status:response.status});continue}
      const beacon=await response.json() as Partial<DrandRound>;
      if(Number.isSafeInteger(beacon.round)&&typeof beacon.signature==="string"&&beacon.signature.length>0)return{kind:"ready",round:beacon as DrandRound};
      console.warn("drand relay returned an invalid beacon",{relay});
    }catch(error){console.warn("drand relay request failed",{relay,error})}
  }
  return sawNotReady?{kind:"not-ready"}:{kind:"unavailable"};
}
