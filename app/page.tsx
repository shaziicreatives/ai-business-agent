"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
const sections = [
  { id:"overview",label:"Overview",icon:"▦",group:"Workspace" },
  { id:"businesses",label:"Businesses",icon:"♙",group:"Workspace" },
  { id:"requests",label:"Access requests",icon:"↗",group:"Workspace" },
  { id:"connections",label:"Website connections",icon:"⌁",group:"Workspace" },
  { id:"automations",label:"Automations",icon:"ϟ",group:"Workspace" },
  { id:"tasks",label:"Task center",icon:"☑",group:"Workspace" },
  { id:"credits",label:"Usage & Credits",icon:"◉",group:"Business Operations" },
  { id:"payments",label:"Payments & invoices",icon:"▤",group:"Business Operations" },
  { id:"support",label:"Support & onboarding",icon:"☏",group:"Business Operations" },
  { id:"team",label:"Team & roles",icon:"♧",group:"Administration" },
  { id:"notifications",label:"Notifications",icon:"♧",group:"Administration" },
  { id:"security",label:"Security & audit logs",icon:"⬡",group:"Administration" },
  { id:"settings",label:"Settings",icon:"⚙",group:"Administration" },
] as const;
type Section = typeof sections[number]["id"];
type RowData = Record<string, any>;
const blankCounts = { pending_requests:0,businesses:0,connections:0,tasks:0 };
const placeholders: Partial<Record<Section,{title:string,description:string}>> = {
  automations:{title:"Automations",description:"Design and review event-driven workflows. Execution remains paused until explicitly enabled."},
  payments:{title:"Payments & invoices",description:"Private financial records, platform invoices and payment reconciliation. No demo figures are displayed."},
  support:{title:"Support & onboarding",description:"Track business onboarding, support requests and setup progress."},
  team:{title:"Team & roles",description:"Review internal team access. Role changes remain restricted to secure owner administration."},
  notifications:{title:"Notifications",description:"Important access, security and system alerts will appear here."},
  settings:{title:"Settings",description:"Manage internal admin access and system preferences."},
};
const titles: Partial<Record<Section,string>> = { credits:"Usage & Credits",requests:"Access requests",businesses:"Businesses",connections:"Website connections",tasks:"Task history",security:"Security & audit logs",automations:"Automations" };

export default function Home(){
 const [active,setActive]=useState<Section>("overview"),[email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [adminEmail,setAdminEmail]=useState(""),[authError,setAuthError]=useState(""),[busy,setBusy]=useState(false),[checking,setChecking]=useState(true);
 const [recoveryMode,setRecoveryMode]=useState(false),[recoverySent,setRecoverySent]=useState(false),[recoveryPassword,setRecoveryPassword]=useState(""),[recoveryConfirm,setRecoveryConfirm]=useState("");
 const [counts,setCounts]=useState(blankCounts),[rows,setRows]=useState<RowData[]>([]),[dataBusy,setDataBusy]=useState(false),[dataError,setDataError]=useState("");
 const [notes,setNotes]=useState<Record<string,string>>({}),[reviewing,setReviewing]=useState("");
 const [creditInputs,setCreditInputs]=useState<Record<string,{quota:string,amount:string,reason:string}>>({}),[creditBusy,setCreditBusy]=useState("");
 const [previewOpen,setPreviewOpen]=useState(false);

 const action=useCallback(async(name:string,extra:RowData={})=>{
   const {data:{session},error:sessionError}=await supabase.auth.getSession();
   if(sessionError||!session) throw new Error("Your admin session has expired. Please sign in again.");
   const response=await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/admin/console`,{
     method:"POST",
     headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},
     body:JSON.stringify({action:name,...extra})
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data?.ok) throw new Error(data?.error||"Admin request failed.");
   return data;
 },[]);
 const loadOverview=useCallback(async()=>{
   try{const d=await action("overview");setCounts(d.counts);}catch(e){setDataError(e instanceof Error?e.message:"Overview failed.");}
 },[action]);
 const loadSection=useCallback(async(section:Section)=>{
   const map:Partial<Record<Section,string>>={requests:"requests",businesses:"businesses",connections:"connections",tasks:"tasks",security:"audit",automations:"automations",credits:"credits"};
   if(!map[section]){setRows([]);return;}
   setDataBusy(true);setDataError("");
   try{const d=await action(map[section]!);setRows(d.data||[]);}catch(e){setRows([]);setDataError(e instanceof Error?e.message:"Could not load records.");}
   finally{setDataBusy(false);}
 },[action]);
 async function verify(token:string){
   const response=await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/v1/admin/verify`,{
     method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:"{}"
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok||!data?.authorized){await supabase.auth.signOut();throw new Error("This account is not authorized for the private admin panel.");}
   setAdminEmail(data.email||"");
 }
 useEffect(()=>{
   let mounted=true;
   const {data:sub}=supabase.auth.onAuthStateChange((event,session)=>{
     if(!mounted)return;
     if(event==="PASSWORD_RECOVERY"){setRecoveryMode(true);setAuthError("");}
     if(!session && event!=="PASSWORD_RECOVERY"){setAdminEmail("");setRows([]);setCounts(blankCounts);}
   });
   supabase.auth.getSession().then(async({data})=>{
     if(data.session){try{await verify(data.session.access_token);}catch(e){if(mounted)setAuthError(e instanceof Error?e.message:"Access check failed.");}}
     if(mounted)setChecking(false);
   });
   return()=>{mounted=false;sub.subscription.unsubscribe();};
 },[]);
 useEffect(()=>{if(adminEmail){void loadOverview();void loadSection(active);}},[adminEmail,active,loadOverview,loadSection]);

 async function login(e:FormEvent<HTMLFormElement>){
   e.preventDefault();setBusy(true);setAuthError("");
   try{const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error||!data.session)throw new Error(error?.message||"Sign in failed.");await verify(data.session.access_token);}
   catch(e){setAuthError(e instanceof Error?e.message:"Unable to sign in.");}finally{setBusy(false);}
 }
 async function sendPasswordReset(){
   setBusy(true);setAuthError("");setRecoverySent(false);
   try{if(!email.trim())throw new Error("Enter your admin email first.");const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:window.location.origin+"/"});if(error)throw error;setRecoverySent(true);}
   catch(e){setAuthError(e instanceof Error?e.message:"Could not send reset email.");}
   finally{setBusy(false);}
 }
 async function saveNewPassword(e:FormEvent<HTMLFormElement>){
   e.preventDefault();setBusy(true);setAuthError("");
   try{if(recoveryPassword.length<8)throw new Error("Password must be at least 8 characters.");if(recoveryPassword!==recoveryConfirm)throw new Error("Passwords do not match.");const {error}=await supabase.auth.updateUser({password:recoveryPassword});if(error)throw error;await supabase.auth.signOut();setRecoveryMode(false);setRecoveryPassword("");setRecoveryConfirm("");setPassword("");setAuthError("Password updated. Sign in with your new password.");}
   catch(e){setAuthError(e instanceof Error?e.message:"Could not update password.");}
   finally{setBusy(false);}
 }
 async function review(id:string,decision:"approve"|"decline"){
   setReviewing(id);setDataError("");
   try{await action("review_request",{id,decision,notes:notes[id]||""});await Promise.all([loadSection("requests"),loadOverview()]);}
   catch(e){setDataError(e instanceof Error?e.message:"Review failed.");}finally{setReviewing("");}
 }
 const current=sections.find(s=>s.id===active)!;
 const fmt=(v:unknown)=>v===null||v===undefined||v===""?"—":String(v);
 const date=(v:string)=>v?new Date(v).toLocaleString():"—";
 const live=["requests","businesses","connections","tasks","security","automations"].includes(active);

 function renderRows(){
   if(dataBusy)return <section className="empty-panel"><h2>Loading records…</h2></section>;
   if(rows.length===0)return <section className="panel data-panel"><div className="empty-inline">No records yet.</div></section>;
   if(active==="credits")return <section className="panel data-panel"><div className="panel-heading"><div><h2>Client AI credit accounts</h2><p>Internal credits are separate from Cloudflare Neurons and provider usage.</p></div><button className="small-action" onClick={()=>void loadSection("credits")}>Refresh</button></div><div className="credit-list">
    {rows.map(row=>{const business=row.business||{};const values=creditInputs[row.business_id]||{quota:String(row.monthly_quota??0),amount:"",reason:""};return <article className="credit-card" key={row.business_id}>
     <div className="credit-card-top"><div><h3>{fmt(business.business_name)}</h3><p>{fmt(business.owner_name)} · {fmt(business.platform)} · {fmt(business.contact_email)}</p></div><span className={"status-pill "+(row.is_blocked?"revoked":"active")}>{row.is_blocked?"BLOCKED":"ACTIVE"}</span></div>
     <div className="credit-metrics"><div><small>Available</small><b>{Number(row.available_credits||0).toLocaleString()}</b></div><div><small>Used this period</small><b>{Number(row.used_this_period||0).toLocaleString()}</b></div><div><small>Monthly quota</small><b>{Number(row.monthly_quota||0).toLocaleString()}</b></div><div><small>Low alert at</small><b>{Number(row.low_balance_threshold||0).toLocaleString()}</b></div></div>
     {row.block_reason&&<p className="credit-warning">{row.block_reason}</p>}
     <div className="credit-controls"><label>Monthly quota<input type="number" min="0" value={values.quota} onChange={e=>setCreditInputs(old=>({...old,[row.business_id]:{...values,quota:e.target.value}}))}/></label><button disabled={creditBusy===row.business_id} onClick={()=>void (async()=>{setCreditBusy(row.business_id);try{await action("set_credit_quota",{business_id:row.business_id,monthly_quota:Number(values.quota),low_balance_threshold:Math.floor(Number(values.quota)*0.2)});await loadSection("credits");}catch(e){setDataError(e instanceof Error?e.message:"Could not save quota.");}finally{setCreditBusy("");}})()}>Save quota</button></div>
     <div className="credit-controls"><label>Top-up credits<input type="number" min="1" value={values.amount} placeholder="e.g. 5000" onChange={e=>setCreditInputs(old=>({...old,[row.business_id]:{...values,amount:e.target.value}}))}/></label><label>Reason<input value={values.reason} placeholder="Monthly top-up" onChange={e=>setCreditInputs(old=>({...old,[row.business_id]:{...values,reason:e.target.value}}))}/></label><button className="primary-action" disabled={creditBusy===row.business_id||!values.amount||!values.reason.trim()} onClick={()=>void (async()=>{setCreditBusy(row.business_id);setDataError("");try{await action("top_up_credits",{business_id:row.business_id,amount:Number(values.amount),reason:values.reason,idempotency_key:crypto.randomUUID()});setCreditInputs(old=>({...old,[row.business_id]:{...values,amount:"",reason:""}}));await loadSection("credits");}catch(e){setDataError(e instanceof Error?e.message:"Top-up failed.");}finally{setCreditBusy("");}})()}>Add credits</button></div>
    </article>})}
    {rows.length===0&&<div className="empty-inline">No client credit accounts yet. Set up an account when a business is approved.</div>}
   </div></section>;
   if(active==="requests")return <section className="panel data-panel"><div className="panel-heading"><div><h2>{rows.length} requests</h2><p>Latest 100 submissions</p></div><button className="small-action" onClick={()=>void loadSection(active)}>Refresh</button></div><div className="record-list">
    {rows.map(row=><article className="request-record" key={row.id}>
     <div className="record-top"><div><h3>{fmt(row.business_name)}</h3><p>{fmt(row.owner_name)} · {fmt(row.contact_email)}</p></div><span className={"status-pill "+row.status}>{row.status}</span></div>
     <div className="record-details"><span><b>Platform:</b> {fmt(row.platform)}</span><span><b>Website:</b> {fmt(row.website_url)}</span><span><b>Phone:</b> {fmt(row.contact_phone)}</span><span><b>Submitted:</b> {date(row.created_at)}</span></div>
     {row.message&&<p className="record-message">{row.message}</p>}
     {(row.status==="pending"||row.status==="under_review")&&<div className="review-controls"><input placeholder="Internal review note (optional)" value={notes[row.id]||""} onChange={e=>setNotes(old=>({...old,[row.id]:e.target.value}))}/><button disabled={reviewing===row.id} onClick={()=>void review(row.id,"approve")}>Approve</button><button className="danger-action" disabled={reviewing===row.id} onClick={()=>void review(row.id,"decline")}>Decline</button></div>}
     {row.review_notes&&<p className="record-message">Review note: {row.review_notes}</p>}
    </article>)}
   </div></section>;
   const headers=active==="businesses"?["Business","Platform","Website","Status","Approved"]:active==="connections"?["Platform","External account","Status","Scopes","Connected"]:active==="tasks"?["Task type","Status","Approval required","Result summary","Created"]:active==="automations"?["Automation","Trigger","Enabled","Approval required","Created"]:["Action","Resource","Outcome","Created"];
   return <section className="panel data-panel"><div className="panel-heading"><div><h2>{rows.length} records</h2><p>Latest 100 records</p></div><button className="small-action" onClick={()=>void loadSection(active)}>Refresh</button></div><div className="table-wrap"><table className="records-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
   {rows.map(row=><tr key={row.id}>{(active==="businesses"?[row.business_name,row.platform,row.website_url,row.status,date(row.approved_at)]:active==="connections"?[row.platform,row.external_account_ref,row.connection_status,(row.granted_scopes||[]).join(", "),date(row.connected_at)]:active==="tasks"?[row.task_type,row.status,row.requires_approval?"Yes":"No",row.output?.response?String(row.output.response).slice(0,100):"—",date(row.created_at)]:active==="automations"?[row.name,row.trigger_type,row.is_enabled?"Yes":"No",row.requires_approval?"Yes":"No",date(row.created_at)]:[row.action,row.resource_type,row.outcome,date(row.created_at)]).map((v,i)=><td key={i}>{fmt(v)}</td>)}</tr>)}
   </tbody></table></div></section>;
 }

 if(checking)return <main className="auth-screen"><div className="auth-card"><img className="auth-logo" src="/creative-clan-logo.webp" alt="Creative Clan — Social Media & Marketing Agency" /><p>Checking private access…</p></div></main>;
 if(recoveryMode)return <main className="auth-screen"><form className="auth-card" onSubmit={saveNewPassword}><img className="auth-logo" src="/creative-clan-logo.webp" alt="Creative Clan" /><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Set a new password</h1><p className="auth-copy">Choose a new password for your private admin account.</p><label>New password<input type="password" autoComplete="new-password" value={recoveryPassword} onChange={e=>setRecoveryPassword(e.target.value)} minLength={8} required/></label><label>Confirm new password<input type="password" autoComplete="new-password" value={recoveryConfirm} onChange={e=>setRecoveryConfirm(e.target.value)} minLength={8} required/></label>{authError&&<p className="auth-error">{authError}</p>}<button className="auth-submit" disabled={busy}>{busy?"Updating password…":"Save new password"}</button></form></main>;
 if(!adminEmail)return <main className="auth-screen"><form className="auth-card" onSubmit={login}><img className="auth-logo" src="/creative-clan-logo.webp" alt="Creative Clan — Social Media & Marketing Agency" /><p className="eyebrow">PRIVATE SUPER ADMIN</p><h1>Welcome back</h1><p className="auth-copy">Sign in with your authorized administrator account.</p><label>Email address<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{authError&&<p className="auth-error">{authError}</p>}<button className="auth-submit" disabled={busy}>{busy?"Verifying access…":"Sign in securely"}</button><button type="button" className="forgot-link" onClick={()=>void sendPasswordReset()} disabled={busy}>{busy?"Sending…":"Forgot password?"}</button>{recoverySent&&<p className="recovery-success">If this admin email is registered, a password reset link has been sent. Check inbox and spam.</p>}<small>No public signup or client login. Only owner-authorized accounts can enter.</small></form></main>;

 return <main className="admin-shell">
  <aside className="sidebar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setActive("overview");}}><img className="sidebar-logo" src="/favicon.webp" alt="Creative Clan" /><span className="brand-name">Creative <b>Clan</b><small>PRIVATE ADMIN CONSOLE</small></span></a>{(["Workspace","Business Operations","Administration"] as const).map(group=><div className="nav-group" key={group}><div className="nav-caption">{group}</div><nav className="side-nav" aria-label={group}>{sections.filter(s=>s.group===group).map(s=><button key={s.id} className={active===s.id?"nav-link active":"nav-link"} onClick={()=>setActive(s.id)}><span className="nav-icon">{s.icon}</span><span>{s.label}</span>{s.id==="requests"&&<span className="nav-count">{counts.pending_requests}</span>}</button>)}</nav></div>)}<div className="sidebar-bottom"><div className="secure-mark">◇</div><div><b>Private workspace</b><small>Owner access only</small></div><span className="secure-dot"/></div></aside>
  <section className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Creative Clan</span><i>/</i>{current.label}</div><div className="topbar-right"><span className="environment"><i/> PRIVATE ADMIN</span><span className="admin-email">{adminEmail}</span><button className="logout-button" onClick={()=>supabase.auth.signOut()}>Sign out</button></div></header>
   <div className="content">
    {active==="overview"?<>
     <div className="welcome-strip"><div><p className="eyebrow">PRIVATE SUPER ADMIN · OWNER WORKSPACE</p><h1>Welcome back, Shawaiz.</h1><p className="subheading">Your Creative Clan command center is ready. Here is the current status of your platform.</p></div><div className="welcome-actions"><span className="live-pill"><i/> SECURE SESSION ACTIVE</span><button className="primary-action" onClick={()=>setActive("requests")}>＋ New access request</button></div></div>
     <div className="overview-toolbar"><div><span className="toolbar-kicker">PLATFORM OVERVIEW</span><b>Live system snapshot</b><small>Figures are read from your secured backend, not demo data.</small></div><button className="small-action" onClick={()=>void loadOverview()}>↻ Refresh data</button></div>
     <div className="stats-grid"><article className="stat-card stat-blue"><div className="stat-top"><span>Authorized businesses</span><span className="stat-icon">♙</span></div><strong>{counts.businesses.toString().padStart(2,"0")}</strong><small>Approved access records</small><div className="stat-foot">LIVE DATABASE COUNT</div></article><article className="stat-card stat-violet"><div className="stat-top"><span>Website connections</span><span className="stat-icon">⌁</span></div><strong>{counts.connections.toString().padStart(2,"0")}</strong><small>Authorized platform connections</small><div className="stat-foot">LIVE DATABASE COUNT</div></article><article className="stat-card stat-cyan"><div className="stat-top"><span>Pending requests</span><span className="stat-icon">↗</span></div><strong>{counts.pending_requests.toString().padStart(2,"0")}</strong><small>Awaiting your review</small><div className="stat-foot">REQUIRES ATTENTION</div></article><article className="stat-card stat-amber"><div className="stat-top"><span>Agent tasks</span><span className="stat-icon">✳</span></div><strong>{counts.tasks.toString().padStart(2,"0")}</strong><small>Recorded task history</small><div className="stat-foot">LIVE DATABASE COUNT</div></article></div>
     {dataError&&<p className="data-error">{dataError}</p>}
     <div className="dashboard-grid"><section className="panel modules-panel"><div className="panel-heading"><div><span className="panel-kicker">WORKSPACE</span><h2>Platform modules</h2><p>Jump straight into a control area</p></div><span className="module-count">14 MODULES</span></div><div className="module-grid">{sections.slice(1).map(s=><button key={s.id} className="module-tile" onClick={()=>setActive(s.id)}><span className="module-icon">{s.icon}</span><span className="module-tile-text">{s.label}</span><span className="module-arrow">↗</span></button>)}</div></section>
     <section className="panel activity-panel"><div className="panel-heading"><div><span className="panel-kicker">SYSTEM STATUS</span><h2>Control plane health</h2><p>Current configuration state</p></div><span className="health-orb">✓</span></div><div className="health-list"><div><span className="health-symbol green">✓</span><span><b>Admin authentication</b><small>Private owner session verified</small></span><em>ACTIVE</em></div><div><span className="health-symbol green">✓</span><span><b>Secure backend</b><small>Protected admin API configured</small></span><em>CONNECTED</em></div><div><span className="health-symbol blue">◇</span><span><b>External integrations</b><small>Waiting for your authorization</small></span><em>PAUSED</em></div><div><span className="health-symbol amber">ϟ</span><span><b>AI runtime</b><small>No model or paid provider enabled</small></span><em>NOT SET</em></div></div><div className="architecture-mini"><b>Platform architecture</b><div><span>Client platform</span><i>↔</i><span>AI agent</span><i>↔</i><span>Admin</span></div><small>Client data stays on its original platform · Permission-based access · Admin approvals</small></div></section></div>
     <div className="bottom-dashboard-grid"><section className="panel quick-panel"><div className="panel-heading"><div><span className="panel-kicker">QUICK ACCESS</span><h2>Pending access requests</h2><p>Review incoming business applications</p></div><button className="text-action" onClick={()=>setActive("requests")}>View all →</button></div><div className="quick-empty"><span>↗</span><div><b>{counts.pending_requests===0?"You're all caught up.":`${counts.pending_requests} request(s) need review.`}</b><small>{counts.pending_requests===0?"No pending requests are currently recorded.":"Open access requests to review and decide."}</small></div></div></section><section className="panel principle-panel"><span className="principle-icon">◇</span><div><span className="panel-kicker">CORE PRINCIPLE</span><h2>Your clients keep their own platforms.</h2><p>AI works through approved connections. Their Shopify or website remains the source of truth — no duplicate inventory system.</p></div></section></div>
    </>:<>
     <div className="page-heading"><div><p className="eyebrow">{live?"LIVE ADMIN DATA":"AGENT CONFIGURATION"}</p><h1>{titles[active]||placeholders[active]?.title}</h1><p className="subheading">{active==="requests"?"Review business requests and approve or decline access.":active==="businesses"?"Internal records of approved businesses. No client portal or login is created.":active==="connections"?"Officially authorized platform connections and their status.":active==="tasks"?"Review internal task history and execution states.":active==="security"?"Internal administrator actions and audit trail.":active==="automations"?"Review automation definitions stored in the control plane. Execution remains disabled until the agent runtime is configured.":placeholders[active]?.description}</p></div><span className="date-label">PRIVATE ADMIN AREA</span></div>
     {dataError&&<p className="data-error">{dataError}</p>}
     {active==="connections" ? <>
      <section className="panel integration-preview">
       <div className="panel-heading"><div><span className="panel-kicker">CLIENT-SIDE EXPERIENCE</span><h2>AI experience preview</h2><p>Shopify can expose Business AI through its approved app entry in admin navigation. Compatible custom dashboards may use a floating shortcut.</p></div><span className="preview-label">VISUAL PREVIEW</span></div>
       <div className="mock-admin">
        <div className="mock-top"><b>my-store.myshopify.com</b><span>Shopify admin · illustrative</span></div>
        <div className="mock-body">
         <aside className="mock-side"><b>MY STORE</b><span>Home</span><span>Orders</span><span className="mock-selected">Products</span><span>Customers</span><span>✳ Business AI</span><span>Settings</span></aside>
         <div className="mock-content"><div className="mock-page-title"><div><small>CATALOG</small><h3>Products</h3></div></div>
          <div className="mock-product"><div className="mock-product-thumb">⌚</div><div><b>Classic Watch</b><small>Inventory · 24 available</small></div><strong>Rs. 4,500</strong></div>
          <div className="mock-product"><div className="mock-product-thumb">🎧</div><div><b>Wireless Headphones</b><small>Inventory · 12 available</small></div><strong>Rs. 3,200</strong></div>
          <div className="mock-hint">The client remains inside their own Shopify admin. This preview does not install or connect anything.</div>
         </div>
        </div>
        <button type="button" className="mock-ai-launcher" aria-label="Open AI assistant preview" onClick={()=>setPreviewOpen(v=>!v)}>✳ AI</button>
        {previewOpen ? <div className="mock-ai-panel"><div className="mock-ai-head"><b>Business AI Assistant</b><button type="button" onClick={()=>setPreviewOpen(false)}>Close</button></div><div className="mock-ai-chat"><b>Hi! How can I help your store today?</b><p>Ask about products, stock, orders or sales.</p><span className="mock-suggestion">Show me low-stock products</span><span className="mock-suggestion">What were today’s sales?</span><span className="mock-suggestion">Update a product price</span><div className="mock-ai-note">Sensitive changes can require owner approval. Sample only — messages and actions are not connected.</div></div></div> : null}
       </div>
      </section>
      <section className="panel data-panel"><div className="panel-heading"><div><h2>Connected platforms</h2><p>Live authorization records from your secure backend</p></div><button className="small-action" onClick={()=>void loadSection("connections")}>Refresh</button></div>{renderRows()}</section>
      <p className="privacy-note">Shopify placement will use its supported embedded app/navigation experience; a floating shortcut is only for compatible custom dashboards. Nothing is installed or connected by this preview.</p>
     </> : active==="tasks" ? renderRows() : live ? renderRows() : active==="settings" ? <section className="panel data-panel"><div className="panel-heading"><div><h2>Workspace settings</h2><p>Private control-plane environment</p></div><span className="status-pill active">SECURE</span></div><div className="record-details"><span><b>Admin access:</b> Supabase Auth + private role check</span><span><b>Database region:</b> Mumbai (ap-south-1)</span><span><b>Client portal:</b> Not enabled</span><span><b>External integrations:</b> Paused</span><span><b>Production website:</b> Not connected or modified</span></div><p className="privacy-note">Admin roles are managed directly in the protected private_admins table. No public role-management controls are exposed.</p></section> : <section className="empty-panel"><div className="empty-symbol">{current.icon}</div><h2>No configuration yet</h2><p>{placeholders[active]?.description} No demo records are shown.</p></section>}
     {active==="businesses"&&<p className="privacy-note">Clients do not receive accounts on Creative Clan. Records are visible only to authorized internal administrators.</p>}
     {active==="connections"&&<p className="privacy-note">Authorization must be granted by the business owner through the platform's official consent flow. Never ask clients to send passwords.</p>}
    </>}
    <footer className="footer"><span>CREATIVE CLAN</span><span>PRIVATE AI BUSINESS AGENT · ADMIN CONTROL PLANE</span></footer>
   </div>
  </section>
 </main>;
}
