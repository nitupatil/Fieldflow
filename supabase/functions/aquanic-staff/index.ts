import { createClient } from "npm:@supabase/supabase-js@2";
const ORG_ID = "a43a7998-0649-4807-8b08-d62beb3e7a0a";
const MASTER_EMAIL = "nitishbadak14@gmail.com";
const H = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const reply = (body: unknown, status=200) => new Response(JSON.stringify(body), {status, headers:H});
Deno.serve(async (req:Request) => {
  if (req.method === "OPTIONS") return new Response("ok",{headers:H});
  if (req.method !== "POST") return reply({error:"Method not allowed"},405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const pub = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default || Deno.env.get("SUPABASE_ANON_KEY")!;
  const secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}").default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  try {
    const body = await req.json();
    if (body.action === "list") {
      const {data:members,error} = await admin.from("organization_members").select("user_id,role").eq("organization_id",ORG_ID).eq("active",true);
      if (error) throw error;
      const ids = (members || []).map((m:any)=>m.user_id);
      if (!ids.length) return reply({users:[]});
      const {data:profiles,error:pe} = await admin.from("profiles").select("id,full_name").in("id",ids);
      if (pe) throw pe;
      const users:any[] = [];
      for (const m of members || []) {
        const {data:u,error:ue} = await admin.auth.admin.getUserById(m.user_id);
        if (ue || !u.user) continue;
        users.push({id:m.user_id,name:profiles?.find((p:any)=>p.id===m.user_id)?.full_name || "Team member",role:m.role});
      }
      users.sort((a,b)=>a.name.localeCompare(b.name));
      return reply({users});
    }
    if (body.action === "login") {
      const userId = String(body.userId || "");
      const pin = String(body.pin || "");
      if (!userId || !pin) return reply({error:"Select a profile and enter your PIN."},400);
      const {data:userData,error:userError} = await admin.auth.admin.getUserById(userId);
      if (userError || !userData.user?.email) return reply({error:"Profile not found."},404);
      const verifier = createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
      const {data:loginData,error:loginError} = await verifier.auth.signInWithPassword({email:userData.user.email,password:pin});
      if (loginError || !loginData.session) return reply({error:"Incorrect PIN. Please try again."},401);
      return reply({session:loginData.session,user:loginData.user});
    }
    if (body.action !== "create") return reply({error:"Unknown action"},400);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i,"");
    if (!token) return reply({error:"Administrator login required"},401);
    const verifier = createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:authData,error:authError} = await verifier.auth.getUser(token);
    if (authError || !authData.user || authData.user.email?.toLowerCase() !== MASTER_EMAIL)
      return reply({error:"Only the master administrator can add staff."},403);
    const {data:membership,error:membershipError} = await admin.from("organization_members").select("role,active").eq("organization_id",ORG_ID).eq("user_id",authData.user.id).maybeSingle();
    if (membershipError || !membership?.active || membership.role !== "admin")
      return reply({error:"Administrator access is required."},403);
    const name=String(body.name||"").trim(),email=String(body.email||"").trim().toLowerCase(),pin=String(body.temporaryPin||"");
    if(name.length<2 || !email.includes("@") || pin.length<6)
      return reply({error:"Enter a name, valid email and temporary PIN of at least 6 characters."},400);
    const {data:created,error:createError}=await admin.auth.admin.createUser({email,password:pin,email_confirm:true,user_metadata:{full_name:name,must_change_pin:true,aquanic_staff:true}});
    if(createError) throw createError;
    const userId=created.user.id;
    const {error:profileError}=await admin.from("profiles").upsert({id:userId,full_name:name},{onConflict:"id"});
    if(profileError){await admin.auth.admin.deleteUser(userId);throw profileError;}
    const {error:memberError}=await admin.from("organization_members").insert({organization_id:ORG_ID,user_id:userId,role:"sales",active:true});
    if(memberError){await admin.auth.admin.deleteUser(userId);throw memberError;}
    return reply({ok:true,user:{id:userId,name,email},mustChangePin:true},201);
  } catch(error) {
    return reply({error:error instanceof Error ? error.message : "Request failed"},400);
  }
});