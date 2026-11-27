import { createClient } from "npm:@supabase/supabase-js@2";
const ORG_ID = "a43a7998-0649-4807-8b08-d62beb3e7a0a";
const MASTER_EMAIL = "nitishbadak14@gmail.com";
const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return reply({error:"Method not allowed"},405);
 const url=Deno.env.get("SUPABASE_URL")!;
 const pub=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||Deno.env.get("SUPABASE_ANON_KEY")!;
 const secret=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const body=await req.json();
  if(body.action==="list"){
   const {data,error}=await admin.from("organization_members").select("user_id,role,profiles(full_name)").eq("organization_id",ORG_ID).eq("active",true);
   if(error)throw error;
   const ids=(data||[]).map((m:any)=>m.user_id);
   const users=[];
   for(const userId of ids){const {data:u,error:ue}=await admin.auth.admin.getUserById(userId);if(ue||!u.user)continue;const m=(data||[]).find((x:any)=>x.user_id===userId);users.push({id:userId,name:m.profiles?.full_name||"Team member",email:u.user.email||"",role:m.role});}
   users.sort((a:any,b:any)=>a.name.localeCompare(b.name));return reply({users});
  }
  if(body.action!=="create")return reply({error:"Unknown action"},400);
  const token=(req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
  if(!token)return reply({error:"Administrator login required"},401);
  const verifier=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:ad,error:ae}=await verifier.auth.getUser(token);
  if(ae||!ad.user||ad.user.email?.toLowerCase()!==MASTER_EMAIL)return reply({error:"Only the master administrator can add staff."},403);
  const {data:mem,error:me}=await admin.from("organization_members").select("role,active").eq("organization_id",ORG_ID).eq("user_id",ad.user.id).maybeSingle();
  if(me||!mem?.active||mem.role!=="admin")return reply({error:"Administrator access is required."},403);
  const name=String(body.name||"").trim(),email=String(body.email||"").trim().toLowerCase(),pin=String(body.temporaryPin||"");
  if(name.length<2||!email.includes("@")||pin.length<6)return reply({error:"Enter a name, valid email and temporary PIN of at least 6 characters."},400);
  const {data:created,error:ce}=await admin.auth.admin.createUser({email,password:pin,email_confirm:true,user_metadata:{full_name:name,must_change_pin:true,aquanic_staff:true}});
  if(ce)throw ce;const uid=created.user.id;
  const {error:pe}=await admin.from("profiles").upsert({id:uid,full_name:name},{onConflict:"id"});
  if(pe){await admin.auth.admin.deleteUser(uid);throw pe;}
  const {error:oe}=await admin.from("organization_members").insert({organization_id:ORG_ID,user_id:uid,role:"staff",active:true});
  if(oe){await admin.auth.admin.deleteUser(uid);throw oe;}
  return reply({ok:true,user:{id:uid,name,email},mustChangePin:true},201);
 }catch(e){return reply({error:e instanceof Error?e.message:"Request failed"},400);}
});