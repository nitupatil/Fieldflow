/* FieldFlow Office v2 — clean business workspace */
(() => {
  "use strict";
  const SUPABASE_URL = "https://pldwrbjolcytodqedrqc.supabase.co";
  const SUPABASE_KEY = "sb_publishable_NvlCKo8LQFIi74V0FPgZ_Q_qT40YS77";
  const $ = (s, root=document) => root.querySelector(s);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = n => "₹" + Number(n || 0).toLocaleString("en-IN",{maximumFractionDigits:2});
  let db, session, orgId, role, currentUser, page="dashboard", customerRows=[], ledgers=[], members=[], dateFrom="", dateTo="";
  const today = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  function notice(message, bad=false){ const n=$("#notice"); n.textContent=message; n.className="notice show"+(bad?" bad":""); setTimeout(()=>n.className="notice",3500); }
  function showAuth(){ $("#authView").hidden=false; $("#appView").hidden=true; }
  function showApp(){ $("#authView").hidden=true; $("#appView").hidden=false; $("#workspaceName").textContent=session?.user?.user_metadata?.company_name || "My workspace"; $("#userEmail").textContent=session?.user?.email||""; }
  async function init(){
    if(!window.supabase){notice("Could not load secure data service. Refresh this page.",true);return;}
    db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    const {data:{session:s}}=await db.auth.getSession(); session=s;
    if(session) await enter(); else showAuth();
    db.auth.onAuthStateChange((_event,s)=>{session=s;if(s) setTimeout(enter,0);else showAuth();});
  }
  async function enter(){
    currentUser=session.user;
    const {data:membership,error}=await db.from("organization_members").select("organization_id,role,active,organizations(id,name,currency)").eq("user_id",currentUser.id).eq("active",true).limit(1).maybeSingle();
    if(error||!membership){showAuth();notice(error?.message||"No active workspace membership found.",true);return;}
    orgId=membership.organization_id;role=membership.role;$("#workspaceName").textContent=membership.organizations?.name||"FieldFlow Office";
    $("#userEmail").textContent=currentUser.email||"";showApp();await loadDashboard();
  }
  async function rows(table, query){let q=db.from(table).select("*").eq("organization_id",orgId);if(query)q=query(q);const {data,error}=await q;if(error)throw error;return data||[];}
  async function loadDashboard(){
    try{
      const [customers,orders,expenses,incomes]=await Promise.all([
        db.from("businesses").select("id",{count:"exact",head:true}).eq("organization_id",orgId).eq("kind","customer").is("deleted_at",null),
        db.from("water_orders").select("id",{count:"exact",head:true}).eq("organization_id",orgId),
        db.from("finance_entries").select("amount").eq("organization_id",orgId).eq("entry_type","expense").is("deleted_at",null).gte("entry_date",dateFrom||today().slice(0,7)+"-01").lte("entry_date",dateTo||today()),
        db.from("finance_entries").select("amount").eq("organization_id",orgId).eq("entry_type","income").is("deleted_at",null).gte("entry_date",dateFrom||today().slice(0,7)+"-01").lte("entry_date",dateTo||today())
      ]);
      [customers,orders,expenses,incomes].forEach(r=>{if(r.error)throw r.error;});
      const sum=a=>(a.data||[]).reduce((s,x)=>s+Number(x.amount||0),0);
      $("#statCustomers").textContent=customers.count??0;$("#statOrders").textContent=orders.count??0;$("#statExpenses").textContent=money(sum(expenses));$("#statIncome").textContent=money(sum(incomes));
      $("#periodFrom").value=dateFrom||today().slice(0,7)+"-01";$("#periodTo").value=dateTo||today();
    }catch(err){notice(err.message+" — apply the FieldFlow Office database migration to enable finance.",true);}
  }
  function go(name){page=name;document.querySelectorAll("[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===name));document.querySelectorAll(".view").forEach(v=>v.hidden=v.id!=="view-"+name);$("#pageTitle").textContent=({dashboard:"Overview",customers:"Customers",expenses:"Expenses",income:"Income",data:"Data library",activity:"Activity log"})[name]||"Overview";if(name==="customers")loadCustomers();if(name==="expenses"||name==="income")loadFinance(name);if(name==="data")loadVault();if(name==="activity")loadActivity();}
  function modal(title,html){$("#modalTitle").textContent=title;$("#modalBody").innerHTML=html;$("#modal").hidden=false;}
  function closeModal(){$("#modal").hidden=true;$("#modalBody").innerHTML="";}
  async function loadCustomers(){
    const {data,error}=await db.from("businesses").select("*").eq("organization_id",orgId).eq("kind","customer").is("deleted_at",null).order("created_at",{ascending:false});
    if(error){notice(error.message,true);return;}customerRows=data||[];
    $("#customerTable").innerHTML=customerRows.length?customerRows.map(c=>'<tr data-customer="'+c.id+'"><td><strong>'+esc(c.name)+'</strong><small>'+esc(c.contact_person||"")+'</small></td><td>'+esc(c.phone||"—")+'</td><td>'+esc(c.address||"—")+'</td><td>'+Number(c.jar_quantity||0)+'</td><td>'+money(c.jar_price??50)+'</td><td><span class="person-dot">'+esc((c.name||"?").slice(0,1).toUpperCase())+'</span></td></tr>').join(""):'<tr><td colspan="6" class="empty">No customers yet. Add your first customer.</td></tr>';
  }
  function customerForm(){modal("Add customer",'<form id="customerForm" class="form-grid"><label>Customer / business name<input name="name" required></label><label>Mobile number<input name="phone" inputmode="tel" required></label><label>Contact person<input name="contact_person"></label><label>Quantity of jars<input name="jar_quantity" type="number" min="0" value="0"></label><label>Price per jar (₹)<input name="jar_price" type="number" min="0" step=".01" value="50"></label><label class="wide">Location / address<input name="address" id="customerAddress" placeholder="Search or paste address"></label><div class="wide location-tools"><button type="button" class="subtle" id="useLocation">Use current location</button><input name="maps_link" id="mapsLink" placeholder="Or paste Google Maps link"><button type="button" class="subtle" id="parseMaps">Read map link</button></div><input type="hidden" name="latitude"><input type="hidden" name="longitude"><div class="wide modal-actions"><button type="button" class="subtle" data-close>Cancel</button><button class="primary">Save customer</button></div></form>');
    $("#useLocation").onclick=()=>navigator.geolocation?.getCurrentPosition(p=>{ $("#customerForm [name=latitude]").value=p.coords.latitude;$("#customerForm [name=longitude]").value=p.coords.longitude;notice("Current location captured.");},e=>notice(e.message,true),{enableHighAccuracy:true});
    $("#parseMaps").onclick=()=>{const s=$("#mapsLink").value;let m=s.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/)||s.match(/[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/)||s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);if(m){$("#customerForm [name=latitude]").value=m[1];$("#customerForm [name=longitude]").value=m[2];notice("Map coordinates extracted.");}else notice("Could not read coordinates. Use a Google Maps pin link.",true);};
    $("#customerForm").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target),v=Object.fromEntries(f);delete v.maps_link;v.organization_id=orgId;v.kind="customer";v.created_by=currentUser.id;v.jar_quantity=Number(v.jar_quantity||0);v.jar_price=Number(v.jar_price||50);["latitude","longitude"].forEach(k=>v[k]=v[k]?Number(v[k]):null);const {error}=await db.from("businesses").insert(v);if(error){notice(error.message,true);return;}closeModal();notice("Customer saved.");loadCustomers();};
  }
  async function loadFinance(kind){
    const {data,error}=await db.from("finance_entries").select("*,finance_ledgers(name)").eq("organization_id",orgId).eq("entry_type",kind==="expenses"?"expense":"income").is("deleted_at",null).order("entry_date",{ascending:false});
    if(error){$("#financeRows").innerHTML='<tr><td colspan="5" class="empty">Finance tables are not installed yet. Apply supabase/office_v2.sql.</td></tr>';return;}
    $("#financeRows").innerHTML=(data||[]).map(x=>'<tr><td>'+esc(x.entry_date)+'</td><td>'+esc(x.description||"—")+'</td><td>'+esc(x.finance_ledgers?.name||"Unassigned")+'</td><td>'+money(x.amount)+'</td><td>'+esc(x.created_by===currentUser.id?"You":"Team member")+'</td></tr>').join("")||'<tr><td colspan="5" class="empty">No entries yet.</td></tr>';
  }
  async function financeForm(kind){
    const {data}=await db.from("finance_ledgers").select("id,name").eq("organization_id",orgId).is("deleted_at",null).order("name");
    ledgers=data||[];const opts=ledgers.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("");
    modal(kind==="expense"?"Add expense":"Add income",'<form id="financeForm" class="form-grid"><label>Amount (₹)<input name="amount" type="number" min=".01" step=".01" required></label><label>Date<input name="entry_date" type="date" value="'+today()+'" required></label><label class="wide">Ledger<select name="ledger_id"><option value="">Choose ledger</option>'+opts+'</select></label><div class="wide inline-create"><input id="newLedger" placeholder="New ledger name"><button type="button" class="subtle" id="createLedger">+ Create ledger</button></div><label class="wide">Description<input name="description" required></label><div class="wide modal-actions"><button type="button" class="subtle" data-close>Cancel</button><button class="primary">Save entry</button></div></form>');
    $("#createLedger").onclick=async()=>{const name=$("#newLedger").value.trim();if(!name)return;const {data,error}=await db.from("finance_ledgers").insert({organization_id:orgId,name,ledger_type:kind,created_by:currentUser.id}).select().single();if(error){notice(error.message,true);return;}const o=document.createElement("option");o.value=data.id;o.textContent=data.name;$("#financeForm [name=ledger_id]").append(o);$("#financeForm [name=ledger_id]").value=data.id;$("#newLedger").value="";};
    $("#financeForm").onsubmit=async ev=>{ev.preventDefault();const v=Object.fromEntries(new FormData(ev.target));v.organization_id=orgId;v.entry_type=kind;v.created_by=currentUser.id;v.amount=Number(v.amount);v.ledger_id=v.ledger_id||null;const {error}=await db.from("finance_entries").insert(v);if(error){notice(error.message,true);return;}closeModal();notice("Entry saved.");loadFinance(kind==="expense"?"expenses":"income");};
  }
  async function loadVault(){
    const {data,error}=await db.from("vault_items").select("*").eq("organization_id",orgId).is("deleted_at",null).order("created_at",{ascending:false});
    if(error){$("#vaultGrid").innerHTML='<div class="empty">Data library is ready after applying supabase/office_v2.sql. You can then upload files and create notes.</div>';return;}
    $("#vaultGrid").innerHTML=(data||[]).map(x=>'<article class="file-card"><div class="file-icon">'+(x.item_type==="note"?"✎":x.item_type==="pdf"?"PDF":"▧")+'</div><strong>'+esc(x.title)+'</strong><small>'+esc(x.folder||"General")+' · '+esc(x.item_type)+'</small>'+(x.item_type==="note"?'<button class="subtle" data-note="'+x.id+'">Open note</button>':"")+'</article>').join("")||'<div class="empty">Your library is empty. Add a note or upload a file.</div>';
  }
  async function addNote(){modal("New note",'<form id="noteForm" class="form-grid"><label class="wide">Title<input name="title" required></label><label class="wide">Folder<input name="folder" value="Notes"></label><label class="wide">Note<textarea name="content" rows="8" required></textarea></label><div class="wide modal-actions"><button type="button" class="subtle" data-close>Cancel</button><button class="primary">Save note</button></div></form>');$("#noteForm").onsubmit=async ev=>{ev.preventDefault();const v=Object.fromEntries(new FormData(ev.target));Object.assign(v,{organization_id:orgId,item_type:"note",created_by:currentUser.id});const {error}=await db.from("vault_items").insert(v);if(error){notice(error.message,true);return;}closeModal();loadVault();};}
  async function loadActivity(){const {data,error}=await db.from("audit_logs").select("*").eq("organization_id",orgId).order("created_at",{ascending:false}).limit(100);$("#activityRows").innerHTML=error?'<tr><td colspan="4">Activity log unavailable for this role.</td></tr>':(data||[]).map(x=>'<tr><td>'+new Date(x.created_at).toLocaleString("en-IN")+'</td><td>'+esc(x.action)+'</td><td>'+esc(x.entity)+'</td><td>'+esc(x.actor_id===currentUser.id?"You":"Team member")+'</td></tr>').join("")||'<tr><td colspan="4" class="empty">No activity recorded.</td></tr>';}
  document.addEventListener("click",ev=>{
    const nav=ev.target.closest("[data-page]");if(nav){go(nav.dataset.page);return;}
    if(ev.target.closest("#addCustomer")){customerForm();return;}
    if(ev.target.closest("#addExpense")){financeForm("expense");return;}
    if(ev.target.closest("#addIncome")){financeForm("income");return;}
    if(ev.target.closest("#addNote")){addNote();return;}
    if(ev.target.closest("#uploadFile")){$("#fileInput").click();return;}
    if(ev.target.closest("[data-close]")||ev.target.id==="modal"){closeModal();return;}
    const tr=ev.target.closest("[data-customer]");if(tr){const c=customerRows.find(x=>x.id===tr.dataset.customer);if(c)modal(c.name,'<div class="profile-view"><p><b>Mobile</b> '+esc(c.phone||"—")+'</p><p><b>Contact</b> '+esc(c.contact_person||"—")+'</p><p><b>Location</b> '+esc(c.address||"—")+'</p><p><b>Jars</b> '+Number(c.jar_quantity||0)+'</p><p><b>Price / jar</b> '+money(c.jar_price??50)+'</p></div>');}
  });
  $("#loginForm").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);const {error}=await db.auth.signInWithPassword({email:f.get("email"),password:f.get("password")});if(error)notice(error.message,true);};
  $("#signupForm").onsubmit=async ev=>{ev.preventDefault();const f=new FormData(ev.target);const {error}=await db.auth.signUp({email:f.get("email"),password:f.get("password"),options:{data:{full_name:f.get("name"),company_name:f.get("company")}}});if(error)notice(error.message,true);else notice("Account created. Check your email if confirmation is enabled.");};
  $("#showSignup").onclick=()=>{$("#loginForm").hidden=true;$("#signupForm").hidden=false;};
  $("#showLogin").onclick=()=>{$("#signupForm").hidden=true;$("#loginForm").hidden=false;};
  $("#logout").onclick=()=>db.auth.signOut();
  $("#addCustomerQuick").onclick=()=>customerForm();$("#addExpenseQuick").onclick=()=>financeForm("expense");$("#addIncomeQuick").onclick=()=>financeForm("income");$("#addDataQuick").onclick=()=>go("data");
  $("#periodApply").onclick=()=>{dateFrom=$("#periodFrom").value;dateTo=$("#periodTo").value;loadDashboard();};
  $("#fileInput").onchange=async ev=>{const file=ev.target.files[0];if(!file)return;const path=orgId+"/library/"+crypto.randomUUID()+"/"+file.name.replace(/[^a-zA-Z0-9._-]/g,"_");const {error}=await db.storage.from("fieldflow-private").upload(path,file,{upsert:false});if(error){notice(error.message,true);return;}const type=file.type==="application/pdf"?"pdf":"image";const {error:dbErr}=await db.from("vault_items").insert({organization_id:orgId,item_type:type,title:file.name,folder:type==="pdf"?"PDFs":"Images",storage_path:path,mime_type:file.type,size_bytes:file.size,created_by:currentUser.id});if(dbErr)notice(dbErr.message,true);else{notice("File added to library.");loadVault();}ev.target.value="";};
  init();
})();