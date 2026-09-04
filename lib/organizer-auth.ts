const COOKIE_NAME="raffle_organizer";
const SESSION_SECONDS=12*60*60;

async function runtimeValue(name:string){
  if(typeof process!=="undefined"&&process.env?.[name])return process.env[name]!;
  try{
    const runtime=await import("cloudflare:workers") as unknown as {env?:Record<string,string>};
    return runtime.env?.[name]??"";
  }catch{return ""}
}

async function sha256Hex(value:string){
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

async function hmacHex(value:string,secret:string){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return [...new Uint8Array(signature)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}

function safeEqual(a:string,b:string){
  if(a.length!==b.length)return false;
  let difference=0;
  for(let index=0;index<a.length;index++)difference|=a.charCodeAt(index)^b.charCodeAt(index);
  return difference===0;
}

function cookieValue(request:Request){
  const cookies=request.headers.get("cookie")??"";
  return cookies.split(";").map(part=>part.trim()).find(part=>part.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length+1)??"";
}

export async function organizerAuthConfigured(){
  return Boolean(await runtimeValue("ORGANIZER_PASSWORD_HASH")&&await runtimeValue("SESSION_SECRET"));
}

export async function verifyOrganizerPassword(password:string){
  const expected=(await runtimeValue("ORGANIZER_PASSWORD_HASH")).toLowerCase();
  return expected.length===64&&safeEqual(await sha256Hex(password),expected);
}

export async function createOrganizerSession(request:Request){
  const secret=await runtimeValue("SESSION_SECRET"),expires=Math.floor(Date.now()/1000)+SESSION_SECONDS,payload=`organizer:${expires}`,signature=await hmacHex(payload,secret),secure=new URL(request.url).protocol==="https:";
  return `${COOKIE_NAME}=${expires}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure?"; Secure":""}`;
}

export async function isOrganizerRequest(request:Request){
  const secret=await runtimeValue("SESSION_SECRET"),value=cookieValue(request);
  if(!secret||!value)return false;
  const [expiresText,signature]=value.split("."),expires=Number(expiresText);
  if(!Number.isSafeInteger(expires)||expires<=Date.now()/1000||!signature)return false;
  const expected=await hmacHex(`organizer:${expires}`,secret);
  return safeEqual(signature,expected);
}

export function clearOrganizerSession(request:Request){
  const secure=new URL(request.url).protocol==="https:";
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure?"; Secure":""}`;
}

export async function requireOrganizer(request:Request){
  if(await isOrganizerRequest(request))return null;
  return Response.json({error:"Organizer sign-in required."},{status:401,headers:{"cache-control":"no-store"}});
}
