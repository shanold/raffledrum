import { clearOrganizerSession,createOrganizerSession,isOrganizerRequest,organizerAuthConfigured,verifyOrganizerPassword } from "@/lib/organizer-auth";

export const dynamic="force-dynamic";

export async function GET(request:Request){
  return Response.json({authenticated:await isOrganizerRequest(request),configured:await organizerAuthConfigured()},{headers:{"cache-control":"no-store"}});
}

export async function POST(request:Request){
  if(!await organizerAuthConfigured())return Response.json({error:"Organizer security has not been configured on this server."},{status:503});
  const body=await request.json().catch(()=>({})) as {password?:string};
  if(typeof body.password!=="string"||body.password.length>256||!await verifyOrganizerPassword(body.password)){
    await new Promise(resolve=>setTimeout(resolve,600));
    return Response.json({error:"Incorrect organizer password."},{status:401,headers:{"cache-control":"no-store"}});
  }
  return Response.json({authenticated:true},{headers:{"set-cookie":await createOrganizerSession(request),"cache-control":"no-store"}});
}

export async function DELETE(request:Request){
  return Response.json({authenticated:false},{headers:{"set-cookie":clearOrganizerSession(request),"cache-control":"no-store"}});
}
