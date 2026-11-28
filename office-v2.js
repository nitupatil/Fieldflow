/* Aquanic Office — customers, water POs, sales and accounts */
(() => {
  "use strict";
  const SUPABASE_URL = "https://pldwrbjolcytodqedrqc.supabase.co";
  const SUPABASE_KEY = "sb_publishable_NvlCKo8LQFIi74V0FPgZ_Q_qT40YS77";
  const ORG_ID = "a43a7998-0649-4807-8b08-d62beb3e7a0a";
  const MASTER_EMAIL = "nitishbadak14@gmail.com";
  const STAFF_FN = SUPABASE_URL + "/functions/v1/aquanic-staff";
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = n => "₹" + Number(n || 0).toLocaleString("en-IN",{maximumFractionDigits:2});
  const today = () => new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const monthStart = () => today().slice(0,7) + "-01";
  const dateText = d => d ? new Date(String(d).length===10?String(d)+"T12:00:00":d).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata",day:"numeric",month:"short",year:"numeric"}) : "—";
  const timeText = d => d ? new Date(d).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"}) : "—";
  const inRange = (d,from,to) => { if(!d)return false;const raw=String(d);const day=raw.length===10?raw:new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(raw));return day>=from&&day<=to; };
  const sum = rows => (rows||[]).reduce((n,x)=>n+Number(x.amount||0),0);
  const palette = ["#65d5dc","#9b9cf4","#f0b66e","#86d8a9","#e88fb2","#78b8ed","#c4a2f2","#d4d66d","#ef9a79"];
  let db, session, currentUser, orgId, role, page="dashboard", staffDirectory=[], selectedStaffId="", customers=[], orders=[], sales=[], saleItems=[], posPayments=[], waterCollections=[], products=[], financeEntries=[], ledgers=[], financeReady=false, activityRows=[], customerSearch="", expenseFilter="all", incomeTab="deposits", reportFrom=monthStart(), reportTo=today(), poFrom="", poTo="", busy=false;

  function notify(message,bad=false){
    const el=$("#notice"); if(!el)return;
    el.textContent=message;el.className="notice show"+(bad?" bad":"");
    clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.className="notice",3800);
  }
  function member(id){return staffDirectory.find(x=>x.id===id);}
  function memberName(id){const m=member(id);return m?.name || (id===currentUser?.id ? (currentUser.user_metadata?.full_name||currentUser.email?.split("@")[0]||"You") : "Team member");}
  function memberColor(id){
    if(!id)return "#64869a";
    let n=0;for(let i=0;i<id.length;i++)n=(n*31+id.charCodeAt(i))>>>0;
    return palette[n%palette.length];
  }
  function creatorTag(id){
    if(!id)return '<span class="creator"><i></i>Unassigned</span>';
    return '<span class="creator" style="--creator-color:'+memberColor(id)+'"><i></i>'+esc(memberName(id))+'</span>';
  }
  function creatorStyle(id){return ' style="--creator-color:'+memberColor(id)+'"';}
  function statusPill(status){
    const s=String(status||"Pending"),cl=s==="Delivered"||s==="Paid"?"green":s==="Out for delivery"||s==="Part paid"?"yellow":s==="Cancelled"?"red":"";
    return '<span class="status-pill '+cl+'">'+esc(s)+'</span>';
  }
  function staffRequest(body,token=""){
    const headers={"Content-Type":"application/json","apikey":SUPABASE_KEY};
    if(token)headers.Authorization="Bearer "+token;
    return fetch(STAFF_FN,{method:"POST",headers,body:JSON.stringify(body)}).then(async res=>{
      const data=await res.json().catch(()=>({error:"Unexpected server response"}));
      if(!res.ok)throw new Error(data.error||"Staff service unavailable");
      return data;
    });
  }
  function showAuth(){
    selectedStaffId="";
    $("#authView").hidden=false;$("#appView").hidden=true;
    $("#staffPicker").hidden=false;$("#pinLoginForm").hidden=true;$("#masterLoginForm").hidden=true;$("#firstPinForm").hidden=true;
    loadStaffDirectory();
  }
  async function loadStaffDirectory(){
    const host=$("#staffDirectory");if(!host)return;
    host.innerHTML='<div class="empty-state">Loading staff profiles…</div>';
    try{
      const result=await staffRequest({action:"list"});staffDirectory=result.users||[];
      host.innerHTML=staffDirectory.length?staffDirectory.map(u=>'<button type="button" class="staff-tile" data-staff="'+esc(u.id)+'"><span class="staff-avatar">'+esc((u.name||"?").slice(0,1).toUpperCase())+'</span><strong>'+esc(u.name||"Team member")+'</strong><small>'+(u.role==="admin"?"Administrator":"Team member")+'</small></button>').join(""):'<div class="empty-state">No team profiles found.<br>Sign in as administrator to add the first team member.</div>';
    }catch(err){host.innerHTML='<div class="empty-state">Staff list could not load.<br>Use administrator sign in.</div>';notify(err.message,true);}
  }
  function pickStaff(id){
    const selected=staffDirectory.find(x=>x.id===id);if(!selected)return;selectedStaffId=id;
    $("#staffPicker").hidden=true;$("#pinLoginForm").hidden=false;$("#selectedStaffName").textContent=selected.name;
    $("#pinLoginForm [name=pin]").value="";$("#pinLoginForm [name=pin]").focus();
  }
  async function finishSignIn(data){
    session=data.session;currentUser=data.user||data.session?.user;
    if(!session||!currentUser){notify("Sign in did not return a session.",true);return;}
    await enter();
  }
  async function init(){
    if(!window.supabase){notify("Secure data service did not load. Refresh the page.",true);return;}
    db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
    const {data:{session:s}}=await db.auth.getSession();
    if(s)await db.auth.signOut({scope:"local"});
    session=null;currentUser=null;showAuth();
  }
  async function enter(){
    currentUser=session.user;
    const {data:membership,error}=await db.from("organization_members").select("organization_id,role,active").eq("user_id",currentUser.id).eq("organization_id",ORG_ID).eq("active",true).maybeSingle();
    if(error||!membership){await db.auth.signOut({scope:"local"});session=null;currentUser=null;showAuth();notify(error?.message||"This profile is not active for Aquanic.",true);return;}
    orgId=membership.organization_id;role=membership.role;
    if(currentUser.user_metadata?.must_change_pin===true){
      $("#authView").hidden=false;$("#appView").hidden=true;$("#staffPicker").hidden=true;$("#pinLoginForm").hidden=true;$("#masterLoginForm").hidden=true;$("#firstPinForm").hidden=false;return;
    }
    showApp();await loadWorkspace();go("dashboard");
  }
  function showApp(){
    $("#authView").hidden=true;$("#appView").hidden=false;
    const name=currentUser.user_metadata?.full_name||currentUser.email?.split("@")[0]||"Team member";
    $("#sideUserName").textContent=name;$("#sideUserRole").textContent=role==="admin"?"Administrator":role==="manager"?"Manager":"Aquanic team";
    $("#sideAvatar").textContent=name.slice(0,1).toUpperCase();$("#sideAvatar").style.background="linear-gradient(145deg,"+memberColor(currentUser.id)+",#287f9f)";
    $("#topUserChip").textContent=name;
  }
  $("#pinLoginForm").onsubmit=async ev=>{
    ev.preventDefault();const id=selectedStaffId;
    if(!id){notify("Choose your profile again.",true);return;}
    const pin=new FormData(ev.target).get("pin");
    try{
      const result=await staffRequest({action:"login",userId:id,pin});
      const {data,error}=await db.auth.setSession({access_token:result.session.access_token,refresh_token:result.session.refresh_token});
      if(error)throw error;await finishSignIn({session:data.session,user:data.user});
    }catch(error){notify(error.message||"Incorrect PIN. Please try again.",true);}
  };
  $("#masterLogin").onclick=()=>{$("#staffPicker").hidden=true;$("#masterLoginForm").hidden=false;};
  $("#backToStaff").onclick=showAuth;$("#backToStaffMaster").onclick=showAuth;
  $("#masterLoginForm").onsubmit=async ev=>{
    ev.preventDefault();const v=Object.fromEntries(new FormData(ev.target));
    const {data,error}=await db.auth.signInWithPassword({email:v.email,password:v.password});
    if(error){notify(error.message,true);return;}await finishSignIn(data);
  };
  $("#firstPinForm").onsubmit=async ev=>{
    ev.preventDefault();const v=Object.fromEntries(new FormData(ev.target));
    if(v.pin!==v.confirm){notify("PIN entries do not match.",true);return;}
    const {data,error}=await db.auth.updateUser({password:v.pin,data:{...currentUser.user_metadata,must_change_pin:false}});
    if(error){notify(error.message,true);return;}
    currentUser=data.user;session=(await db.auth.getSession()).data.session;notify("Your personal PIN is saved.");showApp();await loadWorkspace();go("dashboard");
  };
  $("#changePin").onclick=()=>openModal("Change your PIN",'<form id="changePinForm" class="form-grid"><label class="wide">New PIN / password<input name="pin" type="password" minlength="6" required autocomplete="new-password"></label><label class="wide">Confirm new PIN<input name="confirm" type="password" minlength="6" required autocomplete="new-password"></label><div class="wide modal-actions"><button type="button" class="outline-button" data-close>Cancel</button><button class="primary">Update PIN</button></div></form>');
  $("#logout").onclick=async()=>{await db.auth.signOut({scope:"local"});session=null;currentUser=null;orgId=null;showAuth();};
  async function loadWorkspace(){
    const specs=[
      ["customers",db.from("businesses").select("*").eq("organization_id",orgId).eq("kind","customer").order("created_at",{ascending:false}).limit(1500)],
      ["orders",db.from("water_orders").select("*").eq("organization_id",orgId).order("order_date",{ascending:false}).limit(1500)],
      ["sales",db.from("pos_sales").select("*").eq("organization_id",orgId).order("sale_date",{ascending:false}).limit(1500)],
      ["saleItems",db.from("pos_sale_items").select("*").eq("organization_id",orgId).limit(3000)],
      ["posPayments",db.from("pos_payments").select("*").eq("organization_id",orgId).order("paid_at",{ascending:false}).limit(2000)],
      ["waterCollections",db.from("water_collections").select("*").eq("organization_id",orgId).order("collected_at",{ascending:false}).limit(2000)],
      ["products",db.from("products").select("*").eq("organization_id",orgId).eq("active",true).order("name").limit(1000)]
    ];
    const results=await Promise.all(specs.map(x=>x[1]));
    results.forEach((r,i)=>{
      if(r.error){console.error("Aquanic load "+specs[i][0],r.error);notify("Could not load "+specs[i][0]+": "+r.error.message,true);return;}
      if(specs[i][0]==="customers")customers=r.data||[];
      if(specs[i][0]==="orders")orders=r.data||[];
      if(specs[i][0]==="sales")sales=r.data||[];
      if(specs[i][0]==="saleItems")saleItems=r.data||[];
      if(specs[i][0]==="posPayments")posPayments=r.data||[];
      if(specs[i][0]==="waterCollections")waterCollections=r.data||[];
      if(specs[i][0]==="products")products=r.data||[];
    });
    const [f,l]=await Promise.all([
      db.from("finance_entries").select("*,finance_ledgers(name)").eq("organization_id",orgId).is("deleted_at",null).order("entry_date",{ascending:false}).limit(3000),
      db.from("finance_ledgers").select("id,name,ledger_type").eq("organization_id",orgId).is("deleted_at",null).order("name")
    ]);
    financeReady=!f.error&&!l.error;
    financeEntries=financeReady?(f.data||[]):[];ledgers=financeReady?(l.data||[]):[];
    if(!financeReady)console.info("Finance setup is pending. Apply supabase/office_v2.sql to enable expenses and revenue entries.");
  }
  const navItems=[
    ["dashboard","⌂","Dashboard"],["customers","♙","Customers"],["orders","▤","Purchase Orders"],["sales","▣","Sales"],["expenses","↘","Expenses"],["income","↗","Income"],["reports","◷","Reports"],["more","•••","More"]
  ];
  function go(next){
    page=next;const titles={dashboard:"Dashboard",customers:"Customers",orders:"Purchase Orders",sales:"Sales",expenses:"Expenses",income:"Income",reports:"Monthly report",more:"More tools",products:"Products",staff:"Team",activity:"Activity log"};
    $("#pageTitle").textContent=titles[next]||"Dashboard";
    $("#desktopNav").innerHTML=navItems.map(x=>'<button class="nav-item '+(x[0]===next?"active":"")+'" data-page="'+x[0]+'"><span class="nav-icon">'+x[1]+'</span>'+x[2]+'</button>').join("");
    const mobile=[["dashboard","⌂","Home"],["customers","♙","People"],["orders","▤","POs"],["sales","▣","Sales"],["more","•••","More"]];
    $("#mobileNav").innerHTML=mobile.map(x=>'<button data-page="'+x[0]+'" class="'+((x[0]===next||(x[0]==="more"&&["expenses","income","reports","products","staff","activity"].includes(next)))?"active":"")+'"><span>'+x[1]+'</span><span>'+x[2]+'</span></button>').join("");
    const renderers={dashboard:renderDashboard,customers:renderCustomers,orders:renderOrders,sales:renderSales,expenses:renderExpenses,income:renderIncome,reports:renderReports,more:renderMore,products:renderProducts,staff:renderStaff,activity:renderActivity};
    $("#pageContent").innerHTML=(renderers[next]||renderDashboard)();
    if(next==="activity")loadActivity();
  }
  function openModal(title,html){
    $("#modalTitle").textContent=title;$("#modalBody").innerHTML=html;$("#modal").hidden=false;
  }
  function closeModal(){$("#modal").hidden=true;$("#modalBody").innerHTML="";}
  function customerById(id){return customers.find(x=>x.id===id);}
  function orderById(id){return orders.find(x=>x.id===id);}
  function saleById(id){return sales.find(x=>x.id===id);}
  function reportStats(from,to){
    const water=orders.filter(x=>x.status!=="Cancelled"&&inRange(x.order_date,from,to));
    const pos=sales.filter(x=>x.status!=="Cancelled"&&inRange(x.sale_date,from,to));
    const other=financeEntries.filter(x=>x.entry_type==="income"&&inRange(x.entry_date,from,to));
    const expense=financeEntries.filter(x=>x.entry_type==="expense"&&inRange(x.entry_date,from,to));
    const operating=expense.filter(x=>x.expense_category!=="asset");
    const assets=expense.filter(x=>x.expense_category==="asset");
    const depositsA=waterCollections.filter(x=>inRange(x.collected_at,from,to));
    const depositsB=posPayments.filter(x=>inRange(x.paid_at,from,to));
    const waterRevenue=water.reduce((n,x)=>n+Number(x.total||Number(x.quantity||0)*Number(x.unit_price||0)),0);
    const posRevenue=pos.reduce((n,x)=>n+Number(x.total||0),0);
    const otherRevenue=sum(other);
    const operatingExpense=sum(operating);
    const assetSpend=sum(assets);
    const deposits=sum(depositsA)+sum(depositsB);
    return {waterRevenue,posRevenue,salesRevenue:waterRevenue+posRevenue,otherRevenue,operatingExpense,assetSpend,deposits,profit:waterRevenue+posRevenue+otherRevenue-operatingExpense,waterCount:water.length,posCount:pos.length};
  }
  function heroIllustration(){
    return '<div class="hero-illustration" aria-hidden="true"><svg viewBox="0 0 360 290"><defs><linearGradient id="officeDrop" x1="80" y1="20" x2="290" y2="270" gradientUnits="userSpaceOnUse"><stop stop-color="#e0ffff"/><stop offset=".38" stop-color="#70e0e8"/><stop offset="1" stop-color="#2789b6"/></linearGradient><linearGradient id="officeGlass" x1="125" y1="70" x2="260" y2="250" gradientUnits="userSpaceOnUse"><stop stop-color="#fff" stop-opacity=".85"/><stop offset="1" stop-color="#a8f9ff" stop-opacity=".08"/></linearGradient><filter id="officeBlur"><feGaussianBlur stdDeviation="12"/></filter></defs><ellipse cx="188" cy="255" rx="95" ry="15" fill="#000" opacity=".3" filter="url(#officeBlur)"/><path d="M187 22c-30 49-93 107-93 165a93 93 0 0 0 186 0c0-58-63-116-93-165Z" fill="url(#officeDrop)" stroke="#dcffff" stroke-opacity=".6" stroke-width="2"/><path d="M185 51c-20 37-57 78-57 118 0 30 18 52 47 60-18-16-23-36-16-56 7-22 28-44 43-64-4-22-10-41-17-58Z" fill="url(#officeGlass)"/><path d="M144 157c7-18 20-34 34-52" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".75"/><circle cx="278" cy="77" r="13" fill="#a7f7f4" opacity=".8"/><circle cx="79" cy="116" r="8" fill="#80e7ec" opacity=".7"/><path d="m263 184 14 14 26-29" stroke="#eaffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
  }
  function renderDashboard(){
    const stats=reportStats(monthStart(),today()),poCount=orders.filter(x=>inRange(x.order_date,monthStart(),today())&&x.status!=="Cancelled").length,saleCount=sales.filter(x=>inRange(x.sale_date,monthStart(),today())&&x.status!=="Cancelled").length;
    const recent=orders.slice().sort((a,b)=>String(b.order_date).localeCompare(String(a.order_date))).slice(0,5);
    return '<section class="hero-panel"><div class="hero-copy"><span class="eyebrow">AQUANIC BUSINESS OVERVIEW</span><h1>Every drop.<br><span>Every rupee.</span></h1><p>Your daily operations, sales and accounts — all connected, all accountable.</p><div class="page-actions"><button class="primary" data-action="add-po">＋ Create PO</button><button class="outline-button" data-action="add-sale">＋ Add sale</button></div></div>'+heroIllustration()+'<div class="hero-floating">THIS MONTH<strong>'+money(stats.salesRevenue)+'</strong><span>Sales value recorded</span></div></section>'+
    '<div class="stats-grid"><article class="metric-card" style="--metric-glow:#72e5e9"><div class="metric-label">Customers <span class="metric-icon">♙</span></div><div class="metric-value">'+customers.length.toLocaleString("en-IN")+'</div><div class="metric-foot">Active customer profiles</div></article><article class="metric-card" style="--metric-glow:#8f9ff0"><div class="metric-label">Purchase orders <span class="metric-icon">▤</span></div><div class="metric-value">'+poCount.toLocaleString("en-IN")+'</div><div class="metric-foot">This month · '+orders.length+' total records</div></article><article class="metric-card" style="--metric-glow:#a8e2a6"><div class="metric-label">Sales bills <span class="metric-icon">▣</span></div><div class="metric-value">'+saleCount.toLocaleString("en-IN")+'</div><div class="metric-foot">This month · '+sales.length+' total bills</div></article><article class="metric-card" style="--metric-glow:#e8b46e"><div class="metric-label">Net profit <span class="metric-icon">↗</span></div><div class="metric-value">'+(financeReady?money(stats.profit):"—")+'</div><div class="metric-foot">'+(financeReady?"Sales + other revenue − expenses":"Finance setup required")+'</div></article></div>'+
    '<div class="section-grid"><section class="surface"><div class="surface-head"><h3>Quick actions</h3><small>Common tasks</small></div><div class="surface-body"><div class="quick-actions"><button class="quick-action" data-action="add-customer"><span class="quick-icon">♙</span><strong>Add customer</strong><small>Create a customer profile</small></button><button class="quick-action" data-action="add-po"><span class="quick-icon">▤</span><strong>Add purchase order</strong><small>Record a water-jar PO</small></button><button class="quick-action" data-action="add-sale"><span class="quick-icon">▣</span><strong>Record a sale</strong><small>Create a customer bill</small></button><button class="quick-action" data-action="add-expense"><span class="quick-icon">↘</span><strong>Add expense</strong><small>Operating, asset or recurring</small></button></div></div></section><section class="surface"><div class="surface-head"><h3>Monthly snapshot</h3><small>'+dateText(monthStart())+' – '+dateText(today())+'</small></div><div class="surface-body"><div class="list-stack"><div class="record-card"><div class="record-main"><div class="record-title">Sales revenue</div><div class="record-meta">Water POs + sales bills</div></div><strong class="record-amount">'+money(stats.salesRevenue)+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Deposits collected</div><div class="record-meta">Cash received against sales</div></div><strong class="record-amount">'+money(stats.deposits)+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Other revenue</div><div class="record-meta">Manual income entries</div></div><strong class="record-amount">'+(financeReady?money(stats.otherRevenue):"—")+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Expenses</div><div class="record-meta">Operating + recurring</div></div><strong class="record-amount">'+(financeReady?money(stats.operatingExpense):"—")+'</strong></div></div></div></section></div>'+
    '<section class="surface" style="margin-top:16px"><div class="surface-head"><h3>Latest purchase orders</h3><button class="small-button" data-page="orders">View all →</button></div><div class="surface-body"><div class="list-stack">'+(recent.length?recent.map(o=>{const c=customerById(o.business_id);return '<div class="record-card"'+creatorStyle(o.created_by)+'><div class="record-main"><div class="record-title">'+esc(c?.name||"Customer")+'</div><div class="record-meta">'+dateText(o.order_date)+' · '+Number(o.quantity||0)+' jars · '+creatorTag(o.created_by)+'</div></div><div class="record-amount">'+money(o.total||Number(o.quantity||0)*Number(o.unit_price||0))+'</div>'+statusPill(o.status)+'</div>';}).join(""):'<div class="empty-state">No purchase orders yet. Create your first PO to get started.</div>')+'</div></div></section>';
  }
  function renderCustomers(){
    const filtered=customers.filter(c=>[c.name,c.phone,c.contact_person,c.address,c.city].join(" ").toLowerCase().includes(customerSearch.toLowerCase()));
    return '<div class="page-intro"><div><div class="page-kicker">PEOPLE & RELATIONSHIPS</div><h1>Customers</h1><p>One reliable record for every customer and delivery location.</p></div><div class="page-actions"><button class="primary" data-action="add-customer">＋ Add customer</button></div></div><section class="surface"><div class="surface-head"><h3>Customer directory <span class="status-pill">'+customers.length+' records</span></h3><div class="toolbar"><input class="search-box" id="customerSearch" value="'+esc(customerSearch)+'" placeholder="Search name, mobile or area"></div></div><div class="surface-body"><div class="list-stack">'+(filtered.length?filtered.map(c=>'<article class="record-card customer-card" data-customer="'+c.id+'"'+creatorStyle(c.created_by)+'><span class="staff-avatar" style="--creator-color:'+memberColor(c.created_by)+';background:linear-gradient(145deg,'+memberColor(c.created_by)+',#1b6683)">'+esc((c.name||"?").slice(0,1).toUpperCase())+'</span><div class="record-main"><div class="record-title">'+esc(c.name)+'</div><div class="record-meta">'+esc(c.phone||"No mobile")+' · '+esc(c.city||c.address||"Location not added")+'</div><div class="record-meta">'+creatorTag(c.created_by)+'</div></div><span class="small-button">Open</span></article>').join(""):'<div class="empty-state"><strong>No customers found</strong>Add a customer or try another search.</div>')+'</div></div></section>';
  }
  function renderOrders(){
    const from=poFrom,to=poTo;
    const list=orders.filter(o=>(!from||o.order_date>=from)&&(!to||o.order_date<=to)).sort((a,b)=>String(b.order_date).localeCompare(String(a.order_date)));
    const total=list.filter(x=>x.status!=="Cancelled").reduce((n,x)=>n+Number(x.total||Number(x.quantity||0)*Number(x.unit_price||0)),0);
    const paid=list.reduce((n,x)=>n+Number(x.collected_amount||0),0);
    return '<div class="page-intro"><div><div class="page-kicker">WATER JAR OPERATIONS</div><h1>Purchase orders</h1><p>Create a dated PO for a customer, record deposits and follow its status.</p></div><div class="page-actions"><button class="primary" data-action="add-po">＋ Add PO</button></div></div><div class="stats-grid"><article class="metric-card"><div class="metric-label">PO value</div><div class="metric-value">'+money(total)+'</div><div class="metric-foot">Selected period</div></article><article class="metric-card"><div class="metric-label">Deposits received</div><div class="metric-value">'+money(paid)+'</div><div class="metric-foot">Collected against POs</div></article><article class="metric-card"><div class="metric-label">Outstanding</div><div class="metric-value">'+money(Math.max(0,total-paid))+'</div><div class="metric-foot">Amount yet to collect</div></article><article class="metric-card"><div class="metric-label">PO count</div><div class="metric-value">'+list.length+'</div><div class="metric-foot">All statuses</div></article></div><section class="surface"><div class="surface-head"><h3>PO register</h3><div class="toolbar"><input class="date-filter" id="poFrom" type="date" value="'+esc(from)+'" aria-label="From date"><input class="date-filter" id="poTo" type="date" value="'+esc(to)+'" aria-label="To date"><button class="small-button" data-action="filter-pos">Filter</button><button class="small-button" data-action="clear-po-filter">Clear</button></div></div><div class="surface-body"><div class="list-stack">'+(list.length?list.map(o=>{const c=customerById(o.business_id),due=Math.max(0,Number(o.total||0)-Number(o.collected_amount||0));return '<article class="record-card"'+creatorStyle(o.created_by)+'><div class="record-main"><div class="record-title">'+esc(c?.name||"Customer")+' <span class="status-pill">'+esc(o.quantity)+' jars</span></div><div class="record-meta">'+dateText(o.order_date)+' · '+esc(o.delivery_note||"Water jar PO")+' · '+creatorTag(o.created_by)+'</div><div class="record-meta">Collected '+money(o.collected_amount)+' · Due '+money(due)+'</div></div><div class="record-amount">'+money(o.total||Number(o.quantity||0)*Number(o.unit_price||0))+'</div><div class="record-actions">'+statusPill(o.status)+'<button class="small-button" data-action="po-deposit" data-id="'+o.id+'">Deposit</button><button class="small-button" data-action="po-detail" data-id="'+o.id+'">View</button></div></article>';}).join(""):'<div class="empty-state"><strong>No POs in this date range</strong>Create a new purchase order for a customer.</div>')+'</div></div></section>';
  }
  function renderSales(){
    const list=sales.slice().sort((a,b)=>String(b.sale_date).localeCompare(String(a.sale_date))).slice(0,150);
    const total=list.filter(x=>x.status!=="Cancelled").reduce((n,x)=>n+Number(x.total||0),0),paid=list.reduce((n,x)=>n+Number(x.paid_amount||0),0);
    return '<div class="page-intro"><div><div class="page-kicker">COUNTER & CUSTOMER BILLING</div><h1>Sales</h1><p>Create a bill from your product list. Any amount received is recorded as a customer deposit.</p></div><div class="page-actions"><button class="outline-button" data-page="products">Manage products</button><button class="primary" data-action="add-sale">＋ Add sale</button></div></div><div class="stats-grid"><article class="metric-card"><div class="metric-label">Sales value</div><div class="metric-value">'+money(total)+'</div><div class="metric-foot">Recent bills</div></article><article class="metric-card"><div class="metric-label">Deposits</div><div class="metric-value">'+money(paid)+'</div><div class="metric-foot">Collected on these bills</div></article><article class="metric-card"><div class="metric-label">Balance due</div><div class="metric-value">'+money(Math.max(0,total-paid))+'</div><div class="metric-foot">Pending collection</div></article><article class="metric-card"><div class="metric-label">Products</div><div class="metric-value">'+products.length+'</div><div class="metric-foot">Active catalogue items</div></article></div><section class="surface"><div class="surface-head"><h3>Sales register</h3><small>Latest 150 bills</small></div><div class="surface-body"><div class="list-stack">'+(list.length?list.map(s=>{const c=customerById(s.business_id),due=Math.max(0,Number(s.total||0)-Number(s.paid_amount||0));return '<article class="record-card"'+creatorStyle(s.created_by)+'><div class="record-main"><div class="record-title">'+esc(c?.name||"Walk-in customer")+' <span class="status-pill">'+esc(s.bill_number||"Bill")+'</span></div><div class="record-meta">'+dateText(s.sale_date)+' · Paid '+money(s.paid_amount)+' · Due '+money(due)+' · '+creatorTag(s.created_by)+'</div></div><div class="record-amount">'+money(s.total)+'</div><div class="record-actions">'+statusPill(s.status)+'<button class="small-button" data-action="sale-deposit" data-id="'+s.id+'">Deposit</button><button class="small-button" data-action="sale-detail" data-id="'+s.id+'">View</button></div></article>';}).join(""):'<div class="empty-state"><strong>No sales recorded yet</strong>Add products to your catalogue, then create your first sale.</div>')+'</div></div></section>';
  }
  function financeSetup(){
    return '<section class="surface"><div class="surface-body"><div class="empty-state"><strong>Finance module needs its database setup</strong>Expenses, assets, recurring expense details and other revenue use the Aquanic finance tables. The SQL is prepared in <b>supabase/office_v2.sql</b> but has not been applied to your Supabase project. Run that script once in the Supabase SQL Editor, then refresh this app. Existing customers, POs and sales are not changed by that script.</div></div></section>';
  }
  function renderExpenses(){
    if(!financeReady)return '<div class="page-intro"><div><div class="page-kicker">COSTS & ASSETS</div><h1>Expenses</h1><p>Track daily costs, assets and recurring commitments.</p></div></div>'+financeSetup();
    const list=financeEntries.filter(x=>x.entry_type==="expense"&&(expenseFilter==="all"||x.expense_category===expenseFilter)).sort((a,b)=>String(b.entry_date).localeCompare(String(a.entry_date)));
    const operating=sum(financeEntries.filter(x=>x.entry_type==="expense"&&x.expense_category!=="asset")),asset=sum(financeEntries.filter(x=>x.entry_type==="expense"&&x.expense_category==="asset"));
    return '<div class="page-intro"><div><div class="page-kicker">COSTS & ASSETS</div><h1>Expenses</h1><p>Know what the business spends — and who recorded it.</p></div><div class="page-actions"><button class="primary" data-action="add-expense">＋ Add expense</button></div></div><div class="stats-grid"><article class="metric-card"><div class="metric-label">Operating + recurring</div><div class="metric-value">'+money(operating)+'</div><div class="metric-foot">Included in profit calculation</div></article><article class="metric-card"><div class="metric-label">Asset purchases</div><div class="metric-value">'+money(asset)+'</div><div class="metric-foot">Tracked separately from expenses</div></article><article class="metric-card"><div class="metric-label">Expense records</div><div class="metric-value">'+financeEntries.filter(x=>x.entry_type==="expense").length+'</div><div class="metric-foot">All recorded expenses</div></article><article class="metric-card"><div class="metric-label">Recurring records</div><div class="metric-value">'+financeEntries.filter(x=>x.entry_type==="expense"&&x.expense_category==="recurring").length+'</div><div class="metric-foot">Frequency tagged</div></article></div><section class="surface"><div class="surface-head"><h3>Expense register</h3><div class="toolbar"><select class="date-filter" id="expenseFilter"><option value="all" '+(expenseFilter==="all"?"selected":"")+'>All expenses</option><option value="operating" '+(expenseFilter==="operating"?"selected":"")+'>Operating</option><option value="recurring" '+(expenseFilter==="recurring"?"selected":"")+'>Recurring</option><option value="asset" '+(expenseFilter==="asset"?"selected":"")+'>Assets</option></select></div></div><div class="surface-body"><div class="list-stack">'+(list.length?list.map(x=>'<article class="record-card"'+creatorStyle(x.created_by)+'><div class="record-main"><div class="record-title">'+esc(x.description)+' '+statusPill(x.expense_category==="asset"?"Asset":x.expense_category==="recurring"?"Recurring":"Operating")+'</div><div class="record-meta">'+dateText(x.entry_date)+' · '+esc(x.finance_ledgers?.name||"Unassigned ledger")+(x.asset_name?" · "+esc(x.asset_name):"")+(x.recurrence_frequency?" · "+esc(x.recurrence_frequency)+" cycle":"")+' · '+creatorTag(x.created_by)+'</div></div><div class="record-amount">'+money(x.amount)+'</div>'+(x.expense_category==="recurring"?'<button class="small-button" data-action="repeat-expense" data-id="'+x.id+'">Record next</button>':"")+'</article>').join(""):'<div class="empty-state"><strong>No expenses yet</strong>Add the first operating cost, asset purchase or recurring expense.</div>')+'</div></div></section>';
  }
  function depositRows(){
    const a=waterCollections.map(x=>{const o=orderById(x.order_id),c=customerById(x.business_id);return {id:x.id,date:x.collected_at,kind:"PO deposit",customer:c?.name||"Customer",amount:x.amount,method:x.method,created_by:x.created_by,reference:o?"PO · "+dateText(o.order_date):"Water PO"};});
    const b=posPayments.map(x=>{const s=saleById(x.sale_id),c=customerById(s?.business_id);return {id:x.id,date:x.paid_at,kind:"Sales deposit",customer:c?.name||"Customer",amount:x.amount,method:x.method,created_by:x.created_by,reference:s?.bill_number||"POS bill"};});
    return a.concat(b).sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  }
  function renderIncome(){
    const deposits=depositRows(),other=financeReady?financeEntries.filter(x=>x.entry_type==="income").sort((a,b)=>String(b.entry_date).localeCompare(String(a.entry_date))):[];
    const isDeposits=incomeTab==="deposits",list=isDeposits?deposits:other;
    if(!financeReady&&!isDeposits)return '<div class="page-intro"><div><div class="page-kicker">MONEY RECEIVED</div><h1>Income</h1><p>Keep customer deposits separate from other business revenue.</p></div></div>'+financeSetup()+'<div class="page-actions" style="margin-top:12px"><button class="outline-button" data-action="income-tab" data-id="deposits">← View sales deposits</button></div>';
    return '<div class="page-intro"><div><div class="page-kicker">MONEY RECEIVED</div><h1>Income</h1><p>Keep customer deposits separate from other business revenue.</p></div><div class="page-actions"><button class="primary" data-action="add-income" '+(financeReady?"":"disabled")+'>＋ Add other income</button></div></div><div class="stats-grid"><article class="metric-card"><div class="metric-label">Sales deposits</div><div class="metric-value">'+money(sum(deposits))+'</div><div class="metric-foot">Cash collected against POs and bills</div></article><article class="metric-card"><div class="metric-label">Other revenue</div><div class="metric-value">'+(financeReady?money(sum(other)):"—")+'</div><div class="metric-foot">Manual income entries</div></article><article class="metric-card"><div class="metric-label">Deposit records</div><div class="metric-value">'+deposits.length+'</div><div class="metric-foot">Customer payments</div></article><article class="metric-card"><div class="metric-label">Revenue records</div><div class="metric-value">'+(financeReady?other.length:"—")+'</div><div class="metric-foot">Other income entries</div></article></div><section class="surface"><div class="surface-head"><h3>'+(isDeposits?"Sales deposits":"Other revenue")+'</h3><div class="toolbar"><button class="small-button" data-action="income-tab" data-id="deposits">Sales deposits</button><button class="small-button" data-action="income-tab" data-id="revenue">Other income</button></div></div><div class="surface-body"><div class="list-stack">'+(list.length?list.map(x=>'<article class="record-card"'+creatorStyle(x.created_by)+'><div class="record-main"><div class="record-title">'+esc(isDeposits?x.customer:x.description)+'</div><div class="record-meta">'+dateText(isDeposits?x.date:x.entry_date)+' · '+esc(isDeposits?x.kind:(x.finance_ledgers?.name||"Revenue"))+(isDeposits?" · "+esc(x.method||"Cash"):"")+' · '+creatorTag(x.created_by)+'</div></div><div class="record-amount">'+money(x.amount)+'</div></article>').join(""):'<div class="empty-state"><strong>'+(isDeposits?"No deposits received yet":"No other revenue recorded")+'</strong>'+(isDeposits?"Payments recorded against POs and sales bills will appear here.":"Add a revenue entry to keep non-sales income visible.")+'</div>')+'</div></div></section>';
  }
  function renderReports(){
    const s=reportStats(reportFrom,reportTo);
    return '<div class="page-intro"><div><div class="page-kicker">BUSINESS PERFORMANCE</div><h1>Profit report</h1><p>Choose any date range to see sales value, collections, expenses and net profit.</p></div><div class="page-actions"><button class="outline-button" data-action="export-report">↓ Export CSV</button></div></div><section class="surface" style="margin-bottom:16px"><div class="surface-head"><h3>Report period</h3><div class="toolbar"><input class="date-filter" id="reportFrom" type="date" value="'+esc(reportFrom)+'"><span class="form-note">to</span><input class="date-filter" id="reportTo" type="date" value="'+esc(reportTo)+'"><button class="primary" data-action="apply-report">Run report</button></div></div></section><div class="stats-grid"><article class="metric-card"><div class="metric-label">Net profit</div><div class="metric-value">'+(financeReady?money(s.profit):"—")+'</div><div class="metric-foot">'+(financeReady?"Revenue less operating costs":"Finance setup required")+'</div></article><article class="metric-card"><div class="metric-label">Sales revenue</div><div class="metric-value">'+money(s.salesRevenue)+'</div><div class="metric-foot">'+s.waterCount+' POs · '+s.posCount+' bills</div></article><article class="metric-card"><div class="metric-label">Other revenue</div><div class="metric-value">'+(financeReady?money(s.otherRevenue):"—")+'</div><div class="metric-foot">Non-sales income</div></article><article class="metric-card"><div class="metric-label">Operating expenses</div><div class="metric-value">'+(financeReady?money(s.operatingExpense):"—")+'</div><div class="metric-foot">Includes recurring expenses</div></article></div><section class="surface"><div class="surface-head"><h3>Profit & cash summary</h3><small>'+dateText(reportFrom)+' – '+dateText(reportTo)+'</small></div><div class="surface-body"><div class="list-stack"><div class="record-card"><div class="record-main"><div class="record-title">Water PO sales</div><div class="record-meta">Total PO value, excluding cancelled POs</div></div><strong class="record-amount">'+money(s.waterRevenue)+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">POS / counter sales</div><div class="record-meta">Total bill value, excluding cancelled bills</div></div><strong class="record-amount">'+money(s.posRevenue)+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Other income</div><div class="record-meta">Revenue entries entered in Income</div></div><strong class="record-amount">'+(financeReady?money(s.otherRevenue):"—")+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Operating + recurring expenses</div><div class="record-meta">Deducted from profit</div></div><strong class="record-amount">− '+(financeReady?money(s.operatingExpense):"—")+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Asset purchases</div><div class="record-meta">Tracked separately; not deducted as full expense here</div></div><strong class="record-amount">'+(financeReady?money(s.assetSpend):"—")+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Sales deposits collected</div><div class="record-meta">Cash received against POs and POS bills — not added twice to revenue</div></div><strong class="record-amount">'+money(s.deposits)+'</strong></div></div><div class="form-total" style="margin-top:14px"><span>NET PROFIT FOR SELECTED PERIOD</span><strong>'+(financeReady?money(s.profit):"—")+'</strong></div>'+(financeReady?'':'<p class="form-note">This report can show sales and deposits now. Apply the finance SQL migration to calculate a complete profit figure that includes expenses and other income.</p>')+'</div></section>';
  }
  function renderMore(){
    const links=[["products","▦","Product catalogue","Manage items and sale prices"]];
    if(currentUser?.email?.toLowerCase()===MASTER_EMAIL)links.push(["staff","♙","Team members","Add and manage staff profiles"]);
    links.push(["reports","◷","Profit report","Review any date range"]);
    links.push(["income","↗","Income register","Sales deposits and other revenue"]);
    links.push(["expenses","↘","Expense register","Operating, recurring and asset costs"]);
    links.push(["activity","⌁","Activity log","See who created recent records"]);
    return '<div class="page-intro"><div><div class="page-kicker">MORE WORKSPACE TOOLS</div><h1>More tools</h1><p>Everything else you need to keep Aquanic organised.</p></div></div><div class="more-grid">'+links.map(x=>'<button class="more-link" data-page="'+x[0]+'"><span>'+x[1]+'</span><strong>'+x[2]+'</strong><small>'+x[3]+'</small></button>').join("")+'</div><section class="surface" style="margin-top:16px"><div class="surface-body"><div class="record-card"><div class="record-main"><div class="record-title">Signed in as '+esc(currentUser.user_metadata?.full_name||currentUser.email)+'</div><div class="record-meta">'+esc(role||"team")+' · Each new record is automatically tagged to your profile.</div></div><button class="small-button" data-action="change-pin">Change PIN</button></div></div></section>';
  }
  function renderProducts(){
    return '<div class="page-intro"><div><div class="page-kicker">SALES CATALOGUE</div><h1>Products</h1><p>These products appear in the Add Sale form.</p></div><div class="page-actions">'+(canManageProducts()?'<button class="primary" data-action="add-product">＋ Add product</button>':'')+'</div></div><section class="surface"><div class="surface-head"><h3>Active products</h3><small>'+products.length+' items</small></div><div class="surface-body"><div class="list-stack">'+(products.length?products.map(p=>'<article class="record-card"><div class="record-main"><div class="record-title">'+esc(p.name)+'</div><div class="record-meta">'+esc(p.sku||"No SKU")+' · '+esc(p.category||"General")+' · '+Number(p.stock_qty||0)+' '+esc(p.unit||"pcs")+'</div></div><div class="record-amount">'+money(p.price)+'</div></article>').join(""):'<div class="empty-state"><strong>No active products</strong>'+(canManageProducts()?"Add your first product so the team can record sales.":"Ask the administrator to add products to the catalogue.")+'</div>')+'</div></div></section>';
  }
  function canManageProducts(){return role==="admin"||role==="manager"||currentUser?.email?.toLowerCase()===MASTER_EMAIL;}
  function renderStaff(){
    if(currentUser?.email?.toLowerCase()!==MASTER_EMAIL)return '<section class="surface"><div class="surface-body"><div class="empty-state"><strong>Administrator access required</strong>Only the master account can add staff profiles.</div></div></section>';
    return '<div class="page-intro"><div><div class="page-kicker">TEAM & ACCESS</div><h1>Team members</h1><p>Every customer, PO, sale and finance entry carries the creator’s colour.</p></div><div class="page-actions"><button class="primary" data-action="add-staff">＋ Add staff</button></div></div><section class="surface"><div class="surface-head"><h3>Active profiles</h3><small>'+staffDirectory.length+' members</small></div><div class="surface-body"><div class="list-stack">'+staffDirectory.map(u=>'<article class="record-card"'+creatorStyle(u.id)+'><span class="staff-avatar" style="background:linear-gradient(145deg,'+memberColor(u.id)+',#1b6683)">'+esc((u.name||"?").slice(0,1).toUpperCase())+'</span><div class="record-main"><div class="record-title">'+esc(u.name)+'</div><div class="record-meta">'+esc(u.role==="admin"?"Administrator":"Team member")+' · '+creatorTag(u.id)+'</div></div></article>').join("")+'</div></div></section>';
  }
  async function loadActivity(){
    const host=$("#pageContent");if(!host)return;
    const {data,error}=await db.from("audit_logs").select("*").eq("organization_id",orgId).order("created_at",{ascending:false}).limit(150);
    if(error){host.insertAdjacentHTML("beforeend",'<section class="surface"><div class="surface-body"><div class="empty-state">Activity log is unavailable for this account.</div></div></section>');return;}
    activityRows=data||[];
    const rows=activityRows.map(x=>'<article class="record-card"'+creatorStyle(x.actor_id)+'><div class="record-main"><div class="record-title">'+esc(x.action)+' · '+esc(x.entity)+'</div><div class="record-meta">'+timeText(x.created_at)+' · '+creatorTag(x.actor_id)+'</div></div></article>').join("");
    host.insertAdjacentHTML("beforeend",'<section class="surface"><div class="surface-head"><h3>Recent activity</h3><small>Latest 150 records</small></div><div class="surface-body"><div class="list-stack">'+(rows||'<div class="empty-state">No activity recorded yet.</div>')+'</div></div></section>');
  }
  function customerOptions(selected){
    return '<option value="">Choose a customer</option>'+customers.map(c=>'<option value="'+c.id+'" '+(c.id===selected?"selected":"")+'>'+esc(c.name)+' · '+esc(c.phone||"")+'</option>').join("");
  }
  function customerForm(){
    openModal("Add customer",'<form id="customerForm" class="form-grid"><label>Customer / business name<input name="name" required placeholder="Customer name"></label><label>Mobile number<input name="phone" inputmode="tel" placeholder="Mobile number"></label><label>Contact person<input name="contact_person" placeholder="Optional"></label><label>City / area<input name="city" placeholder="Pune, area"></label><label class="wide">Search address<input id="locationSearch" placeholder="Type area, street or landmark"></label><div class="wide inline-tools"><button type="button" class="outline-button" id="searchLocation">Find location</button><select id="locationResults"><option value="">Choose a matching location</option></select></div><label class="wide">Address<input name="address" id="customerAddress" placeholder="Delivery address"></label><div class="wide inline-tools"><button type="button" class="outline-button" id="useLocation">Use current location</button><input id="mapsLink" placeholder="Or paste a Google Maps link"><button type="button" class="outline-button" id="parseMaps">Read link</button></div><input type="hidden" name="latitude"><input type="hidden" name="longitude"><label class="wide">Notes<textarea name="notes" rows="2" placeholder="Optional customer notes"></textarea></label><div class="wide modal-actions"><button type="button" class="outline-button" data-close>Cancel</button><button class="primary">Save customer</button></div></form>');
    $("#searchLocation").onclick=async()=>{
      const q=$("#locationSearch").value.trim();if(!q)return;
      try{const r=await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q="+encodeURIComponent(q));const a=await r.json();$("#locationResults").innerHTML='<option value="">Choose a matching location</option>'+a.map((x,i)=>'<option value="'+i+'">'+esc(x.display_name)+'</option>').join("");$("#locationResults").dataset.results=JSON.stringify(a);if(!a.length)notify("No matching locations found.",true);}
      catch(e){notify("Location search failed. Try current location or a Maps link.",true);}
    };
    $("#locationResults").onchange=()=>{
      const a=JSON.parse($("#locationResults").dataset.results||"[]"),x=a[Number($("#locationResults").value)];
      if(x){$("#customerAddress").value=x.display_name;$("#customerForm [name=latitude]").value=x.lat;$("#customerForm [name=longitude]").value=x.lon;}
    };
    $("#useLocation").onclick=()=>{
      if(!navigator.geolocation){notify("Location is not available in this browser.",true);return;}
      navigator.geolocation.getCurrentPosition(p=>{$("#customerForm [name=latitude]").value=p.coords.latitude;$("#customerForm [name=longitude]").value=p.coords.longitude;notify("Current location captured.");},e=>notify(e.message,true),{enableHighAccuracy:true,timeout:12000});
    };
    $("#parseMaps").onclick=()=>{
      const s=$("#mapsLink").value,m=s.match(/@(-?\d+\.\d+),\s*(-?\d+\.\d+)/)||s.match(/[?&]q=(-?\d+\.\d+),\s*(-?\d+\.\d+)/)||s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if(m){$("#customerForm [name=latitude]").value=m[1];$("#customerForm [name=longitude]").value=m[2];notify("Map coordinates extracted.");}else notify("Could not read coordinates. Paste a Google Maps pin link.",true);
    };
  }
  function poForm(){
    if(!customers.length){notify("Add a customer before creating a PO.",true);customerForm();return;}
    openModal("Create purchase order",'<form id="poForm" class="form-grid"><label class="wide">Customer<select name="business_id" required>'+customerOptions()+'</select></label><label>PO date<input name="order_date" type="date" value="'+today()+'" required></label><label>Quantity (jars)<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Price per jar (₹)<input name="unit_price" type="number" min="0" step=".01" value="50" required></label><label>Initial deposit (₹)<input name="deposit" type="number" min="0" step=".01" value="0"></label><label>Payment method<select name="method"><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Card</option></select></label><label class="wide">Delivery note<input name="delivery_note" placeholder="Optional note"></label><div class="wide form-total"><span>PO TOTAL</span><strong id="poTotal">₹50</strong></div><div class="wide modal-actions"><button type="button" class="outline-button" data-close>Cancel</button><button class="primary">Save PO</button></div></form>');
    const update=()=>{$("#poTotal").textContent=money(Number($("#poForm [name=quantity]").value||0)*Number($("#poForm [name=unit_price]").value||0));};
    $("#poForm [name=quantity]").oninput=update;$("#poForm [name=unit_price]").oninput=update;update();
  }
  function saleLineHtml(){
    return '<div class="sale-line"><label>Product<select name="product_id" required><option value="">Choose product</option>'+products.map(p=>'<option value="'+p.id+'">'+esc(p.name)+' · '+money(p.price)+'</option>').join("")+'</select></label><label>Qty<input name="quantity" type="number" min=".01" step=".01" value="1" required></label><label>Rate ₹<input name="unit_price" type="number" min="0" step=".01" value="0" required></label><label>Tax %<input name="tax_rate" type="number" min="0" max="100" step=".01" value="0" required></label><button type="button" class="line-remove" data-action="remove-sale-line">×</button></div>';
  }
  function saleTotal(){
    const lines=$$("#saleLines .sale-line").map(row=>{
      const q=Number(row.querySelector('[name=quantity]').value||0),p=Number(row.querySelector('[name=unit_price]').value||0),t=Number(row.querySelector('[name=tax_rate]').value||0);
      return q*p*(1+t/100);
    });
    const total=lines.reduce((a,b)=>a+b,0);const el=$("#saleTotal");if(el)el.textContent=money(total);const deposit=$("#saleForm [name=deposit]");if(deposit)deposit.max=total;
  }
  function saleForm(){
    if(!customers.length){notify("Add a customer before creating a sale.",true);customerForm();return;}
    if(!products.length){openModal("Add products first",'<div class="empty-state"><strong>Your product catalogue is empty</strong>Add at least one active product before creating a sale.</div><div class="modal-actions"><button class="outline-button" data-close>Close</button>'+(canManageProducts()?'<button class="primary" data-action="add-product">Add product</button>':"")+'</div>');return;}
    openModal("Create a sale",'<form id="saleForm" class="form-grid"><label class="wide">Customer<select name="business_id" required>'+customerOptions()+'</select></label><div class="wide"><div class="inline-tools" style="justify-content:space-between;margin-bottom:9px"><strong style="font-size:11px">Sale items</strong><button type="button" class="small-button" data-action="add-sale-line">＋ Add item</button></div><div id="saleLines">'+saleLineHtml()+'</div></div><label>Deposit received (₹)<input name="deposit" type="number" min="0" step=".01" value="0"></label><label>Payment method<select name="method"><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Card</option></select></label><label class="wide">Notes<input name="notes" placeholder="Optional bill note"></label><div class="wide form-total"><span>SALE TOTAL</span><strong id="saleTotal">₹0</strong></div><div class="wide modal-actions"><button type="button" class="outline-button" data-close>Cancel</button><button class="primary">Save sale</button></div></form>');
    $("#saleLines").addEventListener("change",ev=>{
      if(ev.target.name==="product_id"){const p=products.find(x=>x.id===ev.target.value),row=ev.target.closest(".sale-line");if(p){row.querySelector('[name=unit_price]').value=p.price;row.querySelector('[name=tax_rate]').value=p.tax_rate||0;}}
      saleTotal();
    });
    $("#saleLines").addEventListener("input",saleTotal);saleTotal();
  }
  async function poDepositForm(id){
    const o=orderById(id);if(!o)return;
    const due=Math.max(0,Number(o.total||0)-Number(o.collected_amount||0));
    if(due<=0){notify("This PO is already fully paid.");return;}
    openModal("Record PO deposit",'<form id="poDepositForm" class="form-grid" data-id="'+id+'"><div class="wide form-note">Outstanding balance: <b>'+money(due)+'</b></div><label>Amount received (₹)<input name="amount" type="number" min=".01" max="'+due+'" step=".01" required></label><label>Payment method<select name="method"><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Card</option></select></label><label class="wide">Reference / note<input name="reference" placeholder="Optional UPI reference"></label><div class="wide modal-actions"><button type="button" class="outline-button" data-close>Cancel</button><button class="primary">Save deposit</button></div></form>');
  }
  async function saleDepositForm(id){
    const s=saleById(id);if(!s)return;
    const due=Math.max(0,Number(s.total||0)-Number(s.paid_amount||0));
    if(due<=0){notify("This sale is already fully paid.");return;}
    openModal("Record sales deposit",'<form id="saleDepositForm" class="form-grid" data-id="'+id+'"><div class="wide form-note">Outstanding bill balance: <b>'+money(due)+'</b></div><label>Amount received (₹)<input name="amount" type="number" min=".01" max="'+due+'" step=".01" required></label><label>Payment method<select name="method"><option>Cash</option><option>UPI</option><option>Bank transfer</option><option>Card</option></select></label><label class="wide">Reference<input name="reference" placeholder="Optional payment reference"></label><div class="wide modal-actions"><button type="button" class="outline-button" data-close>Cancel</button><button class="primary">Save deposit</button></div></form>');
  }
  async function expenseForm(){
    if(!financeReady){notify("Apply the finance SQL migration to enable expenses.",true);return;}
    openModal("Add expense",'<form id="expenseForm" class="form-grid"><label>Amount (₹)<input name="amount" type="number" min=".01" step=".01" required></label><label>Date<input name="entry_date" type="date" value="'+today()+'" required></label><label class="wide">Expense type<select name="expense_category"><option value="operating">Operating expense</option><option value="recurring">Recurring expense</option><option value="asset">Asset purchase</option></select></label><label class="wide">Description<input name="description" required placeholder="What was paid for?"></label><label class="wide">Ledger<select name="ledger_id"><option value="">No ledger selected</option>'+ledgers.filter(x=>x.ledger_type!=="income").map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><div class="wide inline-tools"><input id="newLedger" placeholder="New expense ledger name"><button type="button" class="outline-button" id="createLedger">＋ Create ledger</button></div><label class="wide">Asset name (assets only)<input name="asset_name" placeholder="e.g. Water purifier, delivery vehicle"></label><label>Recurring frequency<select name="recurrence_frequency"><option value="">Not recurring</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label>Recurring until<input name="recurrence_end_date" type="date"></label><div class="wide form-note">Recurring entries are tagged by frequency. Use “Record next” on an existing recurring expense when the next payment is made. Asset purchases are tracked separately and excluded from the simple profit calculation.</div><div class="wide modal-actions"><button type="button" class="outline-button" data-close>Cancel</button><button class="primary">Save expense</button></div></form>');
    $("#createLedger").onclick=async()=>{
      const name=$("#newLedger").value.trim();if(!name)return;
      const {data,error}=await db.from("finance_ledgers").insert({organization_id:orgId,name,ledger_type:"expense",created_by:currentUser.id}).select().single();
      if(error){notify(error.message,true);return;}
      ledgers.push(data);const opt=document.createElement("option");opt.value=data.id;opt.textContent=data.name;$("#expenseForm [name=ledger_id]").append(opt);$("#expenseForm [name=ledger_id]").value=data.id;$("#newLedger").value="";
    };
  }
  async function incomeForm(){
    if(!financeReady){notify("Apply the finance SQL migration to enable income entries.",true);return;}
    openModal("Add other income",'<form id="incomeForm" class="form-grid"><label>Amount (₹)<input name="amount" type="number" min=".01" step=".01" required></label><label>Date<input name="entry_date" type="date" value="'+today()+'" required></label><label class="wide">Revenue description<input name="description" required placeholder="e.g. Interest, service revenue, other receipts"></label><label class="wide">Income ledger<select name="ledger_id"><option value="">No ledger selected</option>'+ledgers.filter(x=>x.ledger_type!=="expense").map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join("")+'</select></label><div class="wide inline-tools"><input id="newLedger" placeholder="New income ledger name"><button type="button" class="outline-button" id="createLedger">＋ Create ledger</button></div><div class="wide form-note">Sales and PO payments appear separately as customer deposits. Add only non-sales revenue here to avoid counting deposits twice.</div><div class="wide modal-actions"><button type="button" class="outline-button" data-close>Cancel</button><button class="primary">Save income</button></div></form>');
    $("#createLedger").onclick=async()=>{
      const name=$("#newLedger").value.trim();if(!name)return;
      const {data,error}=await db.from("finance_ledgers").insert({organization_id:orgId,name,ledger_type:"income",created_by:currentUser.id}).select().single();
      if(error){notify(error.message,true);return;}
      ledgers.push(data);const opt=document.createElement("option");opt.value=data.id;opt.textContent=data.name;$("#incomeForm [name=ledger_id]").append(opt);$("#incomeForm [name=ledger_id]").value=data.id;$("#newLedger").value="";
    };
  }
  function productForm(){
    if(!canManageProducts()){notify("Only an administrator or manager can manage products.",true);return;}
    openModal("Add product",'<form id="productForm" class="form-grid"><label class="wide">Product name<input name="name" required></label><label>SKU<input name="sku"></label><label>Category<input name="category" placeholder="Water, accessories…"></label><label>Unit<input name="unit" value="pcs" required></label><label>Sale price (₹)<input name="price" type="number" min="0" step=".01" value="0" required></label><label>Cost price (₹)<input name="cost" type="number" min="0" step=".01" value="0"></label><label>Tax rate %<input name="tax_rate" type="number" min="0" max="100" step=".01" value="0"></label><label>Opening stock<input name="stock_qty" type="number" min="0" step=".01" value="0"></label><label class="wide">Description<textarea name="description" rows="2"></textarea></label><div class="wide modal-actions"><button type="button" class="outline-button" data-close>Cancel</button><button class="primary">Save product</button></div></form>');
  }
  function staffForm(){
    if(currentUser?.email?.toLowerCase()!==MASTER_EMAIL){notify("Only the master administrator can add staff.",true);return;}
    openModal("Add team member",'<form id="staffForm" class="form-grid"><label class="wide">Full name<input name="name" required minlength="2"></label><label class="wide">Login email<input name="email" type="email" required></label><label class="wide">Temporary PIN / password<input name="temporaryPin" type="password" minlength="6" required><small>They must change this on first sign-in.</small></label><div class="wide modal-actions"><button type="button" class="outline-button" data-close>Cancel</button><button class="primary">Create staff profile</button></div></form>');
  }
  function showCustomer(id){
    const c=customerById(id);if(!c)return;
    const po=orders.filter(x=>x.business_id===id),sale=sales.filter(x=>x.business_id===id);
    openModal(c.name,'<div class="list-stack"><div class="record-card"><div class="record-main"><div class="record-title">Contact</div><div class="record-meta">'+esc(c.phone||"No mobile")+' · '+esc(c.contact_person||"")+'</div></div>'+creatorTag(c.created_by)+'</div><div class="record-card"><div class="record-main"><div class="record-title">Location</div><div class="record-meta">'+esc(c.address||"Not added")+' · '+esc(c.city||"")+'</div></div></div><div class="record-card"><div class="record-main"><div class="record-title">Purchase orders</div><div class="record-meta">'+po.length+' recorded</div></div><strong class="record-amount">'+money(po.reduce((n,x)=>n+Number(x.total||0),0))+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Sales bills</div><div class="record-meta">'+sale.length+' recorded</div></div><strong class="record-amount">'+money(sale.reduce((n,x)=>n+Number(x.total||0),0))+'</strong></div></div><div class="modal-actions" style="margin-top:15px"><button class="outline-button" data-close>Close</button><button class="primary" data-action="customer-po" data-id="'+id+'">Create PO</button></div>');
  }
  function showPoDetail(id){
    const o=orderById(id);if(!o)return;const c=customerById(o.business_id);
    openModal("Purchase order",'<div class="list-stack"><div class="record-card"><div class="record-main"><div class="record-title">'+esc(c?.name||"Customer")+'</div><div class="record-meta">'+dateText(o.order_date)+' · '+Number(o.quantity)+' jars · '+creatorTag(o.created_by)+'</div></div>'+statusPill(o.status)+'</div><div class="record-card"><div class="record-main"><div class="record-title">PO total</div></div><strong class="record-amount">'+money(o.total||Number(o.quantity)*Number(o.unit_price))+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Deposits collected</div></div><strong class="record-amount">'+money(o.collected_amount)+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Balance due</div></div><strong class="record-amount">'+money(Math.max(0,Number(o.total||0)-Number(o.collected_amount||0)))+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Delivery note</div><div class="record-meta">'+esc(o.delivery_note||"—")+'</div></div></div></div><div class="modal-actions" style="margin-top:15px"><button class="outline-button" data-close>Close</button><button class="small-button" data-action="po-status" data-id="'+id+'" data-status="Out for delivery">Dispatch</button><button class="primary" data-action="po-delivered" data-id="'+id+'">Mark delivered</button></div>');
  }
  function showSaleDetail(id){
    const s=saleById(id);if(!s)return;const c=customerById(s.business_id),items=saleItems.filter(x=>x.sale_id===id);
    openModal("Sales bill · "+esc(s.bill_number||""),'<div class="list-stack"><div class="record-card"><div class="record-main"><div class="record-title">'+esc(c?.name||"Customer")+'</div><div class="record-meta">'+dateText(s.sale_date)+' · '+creatorTag(s.created_by)+'</div></div>'+statusPill(s.status)+'</div>'+(items.map(x=>'<div class="record-card"><div class="record-main"><div class="record-title">'+esc(x.description)+'</div><div class="record-meta">'+Number(x.quantity)+' × '+money(x.unit_price)+'</div></div><strong class="record-amount">'+money(x.line_total)+'</strong></div>').join(""))+'<div class="record-card"><div class="record-main"><div class="record-title">Bill total</div></div><strong class="record-amount">'+money(s.total)+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Deposit received</div></div><strong class="record-amount">'+money(s.paid_amount)+'</strong></div><div class="record-card"><div class="record-main"><div class="record-title">Balance due</div></div><strong class="record-amount">'+money(Math.max(0,Number(s.total)-Number(s.paid_amount)))+'</strong></div></div><div class="modal-actions" style="margin-top:15px"><button class="outline-button" data-close>Close</button><button class="primary" data-action="sale-deposit" data-id="'+id+'">Record deposit</button></div>');
  }
  async function saveCustomer(form){
    const v=Object.fromEntries(new FormData(form));const name=(v.name||"").trim();if(!name)throw new Error("Customer name is required.");
    const payload={organization_id:orgId,kind:"customer",name,phone:v.phone||null,contact_person:v.contact_person||null,city:v.city||null,address:v.address||null,latitude:v.latitude?Number(v.latitude):null,longitude:v.longitude?Number(v.longitude):null,notes:v.notes||null,status:"Active",created_by:currentUser.id,assigned_to:currentUser.id};
    const {data,error}=await db.from("businesses").insert(payload).select().single();if(error)throw error;
    closeModal();notify("Customer saved and assigned to "+memberName(currentUser.id)+".");await loadWorkspace();go("customers");
  }
  async function savePO(form){
    const v=Object.fromEntries(new FormData(form)),q=Number(v.quantity),price=Number(v.unit_price),deposit=Number(v.deposit||0);
    if(!v.business_id)throw new Error("Choose a customer.");
    if(!Number.isInteger(q)||q<1||price<0)throw new Error("Enter a valid quantity and price.");
    if(deposit>q*price)throw new Error("Deposit cannot exceed the PO total.");
    if(orders.some(x=>x.business_id===v.business_id&&x.order_date===v.order_date))throw new Error("This customer already has a PO on that date. Choose another date or review the existing PO.");
    const payload={organization_id:orgId,business_id:v.business_id,order_date:v.order_date,quantity:q,unit_price:price,status:"Pending",delivery_note:v.delivery_note||null,created_by:currentUser.id};
    const {data,error}=await db.from("water_orders").insert(payload).select().single();if(error)throw error;
    let paymentError=null;
    if(deposit>0){
      const {error:pe}=await db.from("water_collections").insert({organization_id:orgId,business_id:v.business_id,order_id:data.id,amount:deposit,method:v.method||"Cash",notes:"Initial PO deposit",created_by:currentUser.id});
      paymentError=pe;
    }
    closeModal();await loadWorkspace();go("orders");
    if(paymentError)notify("PO saved, but deposit failed: "+paymentError.message,true);else notify(deposit>0?"PO and initial deposit saved.":"Purchase order saved.");
  }
  async function saveSale(form){
    const v=Object.fromEntries(new FormData(form)),rows=$$("#saleLines .sale-line");
    const lines=rows.map(row=>({product_id:row.querySelector('[name=product_id]').value,quantity:Number(row.querySelector('[name=quantity]').value),unit_price:Number(row.querySelector('[name=unit_price]').value),tax_rate:Number(row.querySelector('[name=tax_rate]').value)}));
    if(!v.business_id)throw new Error("Choose a customer.");
    if(!lines.length||lines.some(x=>!x.product_id||!(x.quantity>0)||x.unit_price<0||x.tax_rate<0||x.tax_rate>100))throw new Error("Check the products, quantities and rates.");
    const estimate=lines.reduce((n,x)=>n+x.quantity*x.unit_price*(1+x.tax_rate/100),0),deposit=Number(v.deposit||0);
    if(deposit>estimate)throw new Error("Deposit cannot exceed the sale total.");
    const {data:saleId,error}=await db.rpc("fieldflow_save_pos",{p_org:orgId,p_sale:null,p_business:v.business_id,p_notes:v.notes||null,p_lines:lines});
    if(error)throw error;
    let paymentError=null;
    if(deposit>0){const {error:pe}=await db.rpc("fieldflow_pos_collect",{p_sale:saleId,p_amount:deposit,p_method:v.method||"Cash",p_reference:null});paymentError=pe;}
    closeModal();await loadWorkspace();go("sales");
    if(paymentError)notify("Sale saved, but the deposit failed: "+paymentError.message,true);else notify(deposit>0?"Sale and deposit saved.":"Sale saved.");
  }
  async function savePoDeposit(form){
    const id=form.dataset.id,o=orderById(id),v=Object.fromEntries(new FormData(form)),amount=Number(v.amount);
    if(!o||!(amount>0)||amount>Number(o.total||0)-Number(o.collected_amount||0))throw new Error("Enter an amount within the outstanding balance.");
    const {error}=await db.from("water_collections").insert({organization_id:orgId,business_id:o.business_id,order_id:o.id,amount,method:v.method||"Cash",reference:v.reference||null,notes:"PO deposit",created_by:currentUser.id});
    if(error)throw error;closeModal();await loadWorkspace();incomeTab="deposits";go("income");notify("PO deposit recorded.");
  }
  async function saveSaleDeposit(form){
    const id=form.dataset.id,v=Object.fromEntries(new FormData(form)),amount=Number(v.amount),s=saleById(id);
    if(!s||!(amount>0)||amount>Number(s.total)-Number(s.paid_amount))throw new Error("Enter an amount within the outstanding bill balance.");
    const {error}=await db.rpc("fieldflow_pos_collect",{p_sale:id,p_amount:amount,p_method:v.method||"Cash",p_reference:v.reference||null});
    if(error)throw error;closeModal();await loadWorkspace();incomeTab="deposits";go("income");notify("Sales deposit recorded.");
  }
  async function saveFinance(form,kind){
    const v=Object.fromEntries(new FormData(form)),amount=Number(v.amount);
    if(!(amount>0))throw new Error("Enter an amount above zero.");
    const payload={organization_id:orgId,entry_type:kind,amount,entry_date:v.entry_date,description:(v.description||"").trim(),ledger_id:v.ledger_id||null,created_by:currentUser.id};
    if(kind==="expense"){
      payload.expense_category=v.expense_category||"operating";
      payload.asset_name=payload.expense_category==="asset"?(v.asset_name||null):null;
      payload.recurrence_frequency=payload.expense_category==="recurring"?(v.recurrence_frequency||"monthly"):null;
      payload.recurrence_end_date=payload.expense_category==="recurring"?(v.recurrence_end_date||null):null;
      if(payload.expense_category==="asset"&&!payload.asset_name)payload.asset_name=payload.description;
    }
    const {error}=await db.from("finance_entries").insert(payload);if(error)throw error;
    closeModal();await loadWorkspace();if(kind==="income")incomeTab="revenue";go(kind==="expense"?"expenses":"income");notify(kind==="expense"?"Expense saved under your profile.":"Other revenue saved under your profile.");
  }
  async function repeatExpense(id){
    const x=financeEntries.find(e=>e.id===id);if(!x||x.expense_category!=="recurring")return;
    const payload={organization_id:orgId,entry_type:"expense",amount:x.amount,entry_date:today(),description:x.description,ledger_id:x.ledger_id||null,expense_category:"recurring",recurrence_frequency:x.recurrence_frequency||"monthly",recurrence_end_date:x.recurrence_end_date||null,created_by:currentUser.id};
    const {error}=await db.from("finance_entries").insert(payload);if(error)throw error;
    await loadWorkspace();go("expenses");notify("Next recurring expense entry recorded.");
  }
  async function saveProduct(form){
    if(!canManageProducts())throw new Error("Only administrators and managers can add products.");
    const v=Object.fromEntries(new FormData(form)),name=(v.name||"").trim();if(!name)throw new Error("Product name is required.");
    const payload={organization_id:orgId,name,sku:v.sku||null,category:v.category||null,description:v.description||null,unit:v.unit||"pcs",price:Number(v.price||0),cost:Number(v.cost||0),tax_rate:Number(v.tax_rate||0),stock_qty:Number(v.stock_qty||0),active:true,tracks_jars:false,jars_per_unit:1};
    const {error}=await db.from("products").insert(payload);if(error)throw error;
    closeModal();await loadWorkspace();go("products");notify("Product added to the sales catalogue.");
  }
  async function saveStaff(form){
    const v=Object.fromEntries(new FormData(form));
    const {data:{session:active}}=await db.auth.getSession();if(!active?.access_token)throw new Error("Please sign in again before adding staff.");await staffRequest({action:"create",...v},active.access_token);
    closeModal();await loadStaffDirectory();go("staff");notify("Staff profile created. They can now select their name and sign in.");
  }
  async function handleAction(action,id,el){
    if(action==="add-customer"){customerForm();return;}
    if(action==="add-po"){poForm();return;}
    if(action==="add-sale"){saleForm();return;}
    if(action==="add-expense"){await expenseForm();return;}
    if(action==="add-income"){await incomeForm();return;}
    if(action==="add-product"){productForm();return;}
    if(action==="add-staff"){staffForm();return;}
    if(action==="change-pin"){$("#changePin").click();return;}
    if(action==="add-sale-line"){$("#saleLines").insertAdjacentHTML("beforeend",saleLineHtml());saleTotal();return;}
    if(action==="remove-sale-line"){const row=el.closest(".sale-line");if($$("#saleLines .sale-line").length>1)row.remove();else row.querySelectorAll("input").forEach(x=>x.value=x.name==="quantity"?"1":"0");saleTotal();return;}
    if(action==="po-deposit"){await poDepositForm(id);return;}
    if(action==="sale-deposit"){await saleDepositForm(id);return;}
    if(action==="po-detail"){showPoDetail(id);return;}
    if(action==="sale-detail"){showSaleDetail(id);return;}
    if(action==="customer-po"){closeModal();poForm();$("#poForm [name=business_id]").value=id;return;}
    if(action==="po-status"){
      const {error}=await db.from("water_orders").update({status:el.dataset.status,updated_at:new Date().toISOString()}).eq("id",id).eq("organization_id",orgId);
      if(error)throw error;closeModal();await loadWorkspace();go("orders");notify("PO status updated.");return;
    }
    if(action==="po-delivered"){
      const {error}=await db.rpc("fieldflow_complete_water",{p_order:id,p_returned:0,p_notes:"Marked delivered from Aquanic Office"});
      if(error)throw error;closeModal();await loadWorkspace();go("orders");notify("PO marked delivered.");return;
    }
    if(action==="income-tab"){incomeTab=id;go("income");return;}
    if(action==="filter-pos"){poFrom=$("#poFrom")?.value||"";poTo=$("#poTo")?.value||"";if(poFrom&&poTo&&poFrom>poTo){notify("Choose a valid PO date range.",true);return;}go("orders");return;}
    if(action==="clear-po-filter"){poFrom="";poTo="";go("orders");return;}
    if(action==="apply-report"){
      const f=$("#reportFrom").value,t=$("#reportTo").value;if(!f||!t||f>t){notify("Choose a valid date range.",true);return;}
      reportFrom=f;reportTo=t;go("reports");return;
    }
    if(action==="export-report"){exportReport();return;}
    if(action==="repeat-expense"){await repeatExpense(id);return;}
  }
  function exportReport(){
    const s=reportStats(reportFrom,reportTo);
    const rows=[["Metric","Amount (INR)"],["Water PO sales",s.waterRevenue],["POS sales",s.posRevenue],["Other revenue",s.otherRevenue],["Operating and recurring expenses",s.operatingExpense],["Asset purchases",s.assetSpend],["Sales deposits received",s.deposits],["Net profit",s.profit]];
    const csv=rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download="aquanic-profit-"+reportFrom+"-to-"+reportTo+".csv";document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  document.addEventListener("click",async ev=>{
    const staff=ev.target.closest("[data-staff]");if(staff){pickStaff(staff.dataset.staff);return;}
    const nav=ev.target.closest("[data-page]");if(nav){go(nav.dataset.page);return;}
    const action=ev.target.closest("[data-action]");if(action){try{await handleAction(action.dataset.action,action.dataset.id,action);}catch(err){notify(err.message||"Action failed.",true);}return;}
    if(ev.target.closest("[data-close]")||ev.target.id==="modal"){closeModal();return;}
    const customer=ev.target.closest("[data-customer]");if(customer){showCustomer(customer.dataset.customer);return;}
  });
  document.addEventListener("input",ev=>{
    if(ev.target.id==="customerSearch"){customerSearch=ev.target.value;const pos=ev.target.selectionStart;go("customers");const field=$("#customerSearch");field.focus();field.setSelectionRange(pos,pos);}
    if(ev.target.closest("#saleLines"))saleTotal();
  });
  document.addEventListener("change",ev=>{
    if(ev.target.id==="expenseFilter"){expenseFilter=ev.target.value;go("expenses");}
    if(ev.target.closest("#saleLines")&&ev.target.name==="product_id"){
      const p=products.find(x=>x.id===ev.target.value),row=ev.target.closest(".sale-line");
      if(p){row.querySelector('[name=unit_price]').value=p.price;row.querySelector('[name=tax_rate]').value=p.tax_rate||0;}saleTotal();
    }
  });
  document.addEventListener("submit",async ev=>{
    const form=ev.target;if(!form.id)return;
    const handlers={
      customerForm:()=>saveCustomer(form),
      poForm:()=>savePO(form),
      saleForm:()=>saveSale(form),
      poDepositForm:()=>savePoDeposit(form),
      saleDepositForm:()=>saveSaleDeposit(form),
      expenseForm:()=>saveFinance(form,"expense"),
      incomeForm:()=>saveFinance(form,"income"),
      productForm:()=>saveProduct(form),
      staffForm:()=>saveStaff(form)
    };
    if(form.id==="changePinForm"){
      ev.preventDefault();const v=Object.fromEntries(new FormData(form));if(v.pin!==v.confirm){notify("PIN entries do not match.",true);return;}
      const {data,error}=await db.auth.updateUser({password:v.pin,data:{...currentUser.user_metadata,must_change_pin:false}});
      if(error){notify(error.message,true);return;}currentUser=data.user;closeModal();showApp();notify("Your PIN has been changed.");return;
    }
    if(!handlers[form.id])return;
    ev.preventDefault();if(busy)return;busy=true;
    const submit=form.querySelector('button[type="submit"],button:not([type])');if(submit){submit.disabled=true;submit.textContent="Saving…";}
    try{await handlers[form.id]();}
    catch(err){notify(err.message||"Could not save this record.",true);}
    finally{busy=false;if(submit&&submit.isConnected){submit.disabled=false;submit.textContent="Save";}}
  });
  $("#periodApply")?.addEventListener("click",()=>{});
  init();
})();