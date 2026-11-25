"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
const sections = [
  { id:"overview",label:"Overview",icon:"⌂" },{ id:"requests",label:"Access requests",icon:"⇥" },
  { id:"businesses",label:"Authorized businesses",icon:"▦" },{ id:"connections",label:"Website connections",icon:"↔" },
  { id:"ai",label:"AI control center",icon:"✧" },{ id:"automations",label:"Automations",icon:"⟳" },
  { id:"tasks",label:"Task center",icon:"☷" },{ id:"usage",label:"Usage & costs",icon:"◷" },
  { id:"security",label:"Audit & security",icon:"◇" },{ id:"settings",label:"Settings",icon:"⚙" },
] as const;
type Section = typeof sections[number]["id"];
type RowData = Record<string, any>;
const blankCounts = { pending_requests:0,businesses:0,connections:0,tasks:0 };
const placeholders: Partial<Record<Section,{title:string,description:string}>> = {
  ai:{title:"AI control center",description:"AI model configuration and agent controls will appear here."},
  automations:{title:"Automations",description:"Create and manage event-driven business workflows."},
  usage:{title:"Usage & costs",description:"Track model usage, platform usage and infrastructure costs."},
  settings:{title:"Settings",description:"Manage internal admin access and system preferences."},
};
const titles: Partial<Record<Section,string>> = { requests:"Access requests",businesses:"Authorized businesses",connections:"Website connections",tasks:"Task center",security:"Audit & security",automations:"Automations",usage:"Usage & costs" };

export default function Home(){
 const [active,setActive]=useState<Section>("overview"),[email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [adminEmail,setAdminEmail]=useState(""),[authError,setAuthError]=useState(""),[busy,setBusy]=useState(false),[checking,setChecking]=useState(true);
 const [counts,setCounts]=useState(blankCounts),[rows,setRows]=useState<RowData[]>([]),[dataBusy,setDataBusy]=useState(false),[dataError,setDataError]=useState("");
 const [notes,setNotes]=useState<Record<string,string>>({}),[reviewing,setReviewing]=useState("");

 const action=useCallback(async(name:string,extra:RowData={})=>{
   const {data,error}=await supabase.functions.invoke("admin-console",{body:{action:name,...extra}});
   if(error||!data?.ok) throw new Error(data?.error||error?.message||"Admin request failed.");
   return data;
 },[]);
 const loadOverview=useCallback(async()=>{
   try{const d=await action("overview");setCounts(d.counts);}catch(e){setDataError(e instanceof Error?e.message:"Overview failed.");}
 },[action]);
 const loadSection=useCallback(async(section:Section)=>{
   const map:Partial<Record<Section,string>>={requests:"requests",businesses:"businesses",connections:"connections",tasks:"tasks",security:"audit",automations:"automations",usage:"usage"};
   if(!map[section]){setRows([]);return;}
   setDataBusy(true);setDataError("");
   try{const d=await action(map[section]!);setRows(d.data||[]);}catch(e){setRows([]);setDataError(e instanceof Error?e.message:"Could not load records.");}
   finally{setDataBusy(false);}
 },[action]);
 async function verify(token:string){
   const {data,error}=await supabase.functions.invoke("admin-verify",{headers:{Authorization:"Bearer "+token},body:{}});
   if(error||!data?.authorized){await supabase.auth.signOut();throw new Error("This account is not authorized for the private admin panel.");}
   setAdminEmail(data.email||"");
 }
 useEffect(()=>{
   let mounted=true;
   supabase.auth.getSession().then(async({data})=>{
     if(data.session){try{await verify(data.session.access_token);}catch(e){if(mounted)setAuthError(e instanceof Error?e.message:"Access check failed.");}}
     if(mounted)setChecking(false);
   });
   const {data:sub}=supabase.auth.onAuthStateChange((_event,session)=>{
     if(!session && mounted){setAdminEmail("");setRows([]);setCounts(blankCounts);}
   });
   return()=>{mounted=false;sub.subscription.unsubscribe();};
 },[]);
 useEffect(()=>{if(adminEmail){void loadOverview();void loadSection(active);}},[adminEmail,active,loadOverview,loadSection]);

 async function login(e:FormEvent<HTMLFormElement>){
   e.preventDefault();setBusy(true);setAuthError("");
   try{const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error||!data.session)throw new Error(error?.message||"Sign in failed.");await verify(data.session.access_token);}
   catch(e){setAuthError(e instanceof Error?e.message:"Unable to sign in.");}finally{setBusy(false);}
 }
 async function review(id:string,decision:"approve"|"decline"){
   setReviewing(id);setDataError("");
   try{await action("review_request",{id,decision,notes:notes[id]||""});await Promise.all([loadSection("requests"),loadOverview()]);}
   catch(e){setDataError(e instanceof Error?e.message:"Review failed.");}finally{setReviewing("");}
 }
 const current=sections.find(s=>s.id===active)!;
 const fmt=(v:unknown)=>v===null||v===undefined||v===""?"—":String(v);
 const date=(v:string)=>v?new Date(v).toLocaleString():"—";
 const live=["requests","businesses","connections","tasks","security","automations","usage"].includes(active);

 function renderRows(){
   if(dataBusy)return <section className="empty-panel"><h2>Loading records…</h2></section>;
   if(rows.length===0)return <section className="panel data-panel"><div className="empty-inline">No records yet.</div></section>;
   if(active==="requests")return <section className="panel data-panel"><div className="panel-heading"><div><h2>{rows.length} requests</h2><p>Latest 100 submissions</p></div><button className="small-action" onClick={()=>void loadSection(active)}>Refresh</button></div><div className="record-list">
    {rows.map(row=><article className="request-record" key={row.id}>
     <div className="record-top"><div><h3>{fmt(row.business_name)}</h3><p>{fmt(row.owner_name)} · {fmt(row.contact_email)}</p></div><span className={"status-pill "+row.status}>{row.status}</span></div>
     <div className="record-details"><span><b>Platform:</b> {fmt(row.platform)}</span><span><b>Website:</b> {fmt(row.website_url)}</span><span><b>Phone:</b> {fmt(row.contact_phone)}</span><span><b>Submitted:</b> {date(row.created_at)}</span></div>
     {row.message&&<p className="record-message">{row.message}</p>}
     {(row.status==="pending"||row.status==="under_review")&&<div className="review-controls"><input placeholder="Internal review note (optional)" value={notes[row.id]||""} onChange={e=>setNotes(old=>({...old,[row.id]:e.target.value}))}/><button disabled={reviewing===row.id} onClick={()=>void review(row.id,"approve")}>Approve</button><button className="danger-action" disabled={reviewing===row.id} onClick={()=>void review(row.id,"decline")}>Decline</button></div>}
     {row.review_notes&&<p className="record-message">Review note: {row.review_notes}</p>}
    </article>)}
   </div></section>;
   const headers=active==="businesses"?["Business","Platform","Website","Status","Approved"]:active==="connections"?["Platform","External account","Status","Scopes","Connected"]:active==="tasks"?["Task type","Status","Approval required","Created"]:active==="automations"?["Automation","Trigger","Enabled","Approval required","Created"]:active==="usage"?["Provider","Model","Input units","Output units","Estimated cost","Recorded"]:["Action","Resource","Outcome","Created"];
   return <section className="panel data-panel"><div className="panel-heading"><div><h2>{rows.length} records</h2><p>Latest 100 records</p></div><button className="small-action" onClick={()=>void loadSection(active)}>Refresh</button></div><div className="table-wrap"><table className="records-table"><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
   {rows.map(row=><tr key={row.id}>{(active==="businesses"?[row.business_name,row.platform,row.website_url,row.status,date(row.approved_at)]:active==="connections"?[row.platform,row.external_account_ref,row.connection_status,(row.granted_scopes||[]).join(", "),date(row.connected_at)]:active==="tasks"?[row.task_type,row.status,row.requires_approval?"Yes":"No",date(row.created_at)]:active==="automations"?[row.name,row.trigger_type,row.is_enabled?"Yes":"No",row.requires_approval?"Yes":"No",date(row.created_at)]:active==="usage"?[row.provider,row.model,row.input_units,row.output_units,fmt(row.estimated_cost)+" "+fmt(row.currency),date(row.recorded_at)]:[row.action,row.resource_type,row.outcome,date(row.created_at)]).map((v,i)=><td key={i}>{fmt(v)}</td>)}</tr>)}
   </tbody></table></div></section>;
 }

 if(checking)return <main className="auth-screen"><div className="auth-card"><img className="auth-logo" src="/creative-clan-logo.webp" alt="Creative Clan — Social Media & Marketing Agency" /><p>Checking private access…</p></div></main>;
 if(!adminEmail)return <main className="auth-screen"><form className="auth-card" onSubmit={login}><img className="auth-logo" src="/creative-clan-logo.webp" alt="Creative Clan — Social Media & Marketing Agency" /><p className="eyebrow">PRIVATE SUPER ADMIN</p><h1>Welcome back</h1><p className="auth-copy">Sign in with your authorized administrator account.</p><label>Email address<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{authError&&<p className="auth-error">{authError}</p>}<button className="auth-submit" disabled={busy}>{busy?"Verifying access…":"Sign in securely"}</button><small>No public signup or client login. Only owner-authorized accounts can enter.</small></form></main>;

 return <main className="admin-shell">
  <aside className="sidebar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setActive("overview");}}><img className="sidebar-logo" src="/favicon.webp" alt="Creative Clan" /><span className="brand-name">Creative <b>Clan</b><small>PRIVATE ADMIN CONSOLE</small></span></a><div className="nav-caption">CONTROL CENTER</div><nav className="side-nav" aria-label="Admin navigation">
   {sections.map(s=><button key={s.id} className={active===s.id?"nav-link active":"nav-link"} onClick={()=>setActive(s.id)}><span className="nav-icon">{s.icon}</span><span>{s.label}</span>{s.id==="requests"&&<span className="nav-count">{counts.pending_requests}</span>}</button>)}
  </nav><div className="sidebar-bottom"><div className="secure-mark">◇</div><div><b>Private workspace</b><small>Owner access only</small></div><span className="secure-dot"/></div></aside>
  <section className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Creative Clan</span><i>/</i>{current.label}</div><div className="topbar-right"><span className="environment"><i/> PRIVATE ADMIN</span><span className="admin-email">{adminEmail}</span><button className="logout-button" onClick={()=>supabase.auth.signOut()}>Sign out</button></div></header>
   <div className="content">
    {active==="overview"?<>
     <div className="page-heading"><div><p className="eyebrow">PRIVATE SUPER ADMIN</p><h1>Control center</h1><p className="subheading">Your AI business operations, access and systems in one place.</p></div><span className="date-label">LIVE SYSTEM OVERVIEW</span></div>
     <div className="notice"><span className="notice-icon">i</span><div><b>Private admin authentication is active</b><p>Live counts are read from your secured backend.</p></div></div>
     <div className="section-title"><div><h2>System overview</h2><p>Current records from your private control plane.</p></div><button className="small-action" onClick={()=>void loadOverview()}>Refresh</button></div>
     <div className="stats-grid"><article className="stat-card"><span>Pending requests</span><strong>{counts.pending_requests}</strong><small>Awaiting your review</small><span className="stat-icon">⇥</span></article><article className="stat-card"><span>Authorized businesses</span><strong>{counts.businesses}</strong><small>Active approvals</small><span className="stat-icon">▦</span></article><article className="stat-card"><span>Active connections</span><strong>{counts.connections}</strong><small>Connected platforms</small><span className="stat-icon">↔</span></article><article className="stat-card"><span>Agent tasks</span><strong>{counts.tasks}</strong><small>Recorded tasks</small><span className="stat-icon">☷</span></article></div>
     {dataError&&<p className="data-error">{dataError}</p>}
     <div className="overview-grid"><section className="panel"><div className="panel-heading"><div><h2>System modules</h2><p>Private control areas</p></div><span className="module-count">10 MODULES</span></div><div className="module-list">{sections.slice(1).map(s=><button key={s.id} className="module-row" onClick={()=>setActive(s.id)}><span className="module-icon">{s.icon}</span><span>{s.label}</span><span className="module-arrow">↗</span></button>)}</div></section>
     <section className="panel architecture-panel"><p className="eyebrow">ARCHITECTURE RULE</p><h2>Your clients keep using their own platforms.</h2><p>The agent reads and acts through approved integrations. Their store data stays in Shopify or the original platform — it is not copied into a second inventory system.</p><div className="architecture-flow"><span>Client platform</span><i>↔</i><span>AI agent</span><i>↔</i><span>Admin control</span></div><div className="security-foot"><span>◇</span> Permission-based access · Admin approvals · Audit trail</div></section></div>
    </>:<>
     <div className="page-heading"><div><p className="eyebrow">{live?"LIVE ADMIN DATA":"AGENT CONFIGURATION"}</p><h1>{titles[active]||placeholders[active]?.title}</h1><p className="subheading">{active==="requests"?"Review business requests and approve or decline access.":active==="businesses"?"Internal records of approved businesses. No client portal or login is created.":active==="connections"?"Officially authorized platform connections and their status.":active==="tasks"?"Agent execution history and task states.":active==="security"?"Internal administrator actions and audit trail.":active==="automations"?"Review automation definitions stored in the control plane. Execution remains disabled until the agent runtime is configured.":active==="usage"?"Review recorded model and platform usage with estimated costs.":placeholders[active]?.description}</p></div><span className="date-label">PRIVATE ADMIN AREA</span></div>
     {dataError&&<p className="data-error">{dataError}</p>}
     {live?renderRows():active==="ai"?<section className="panel data-panel"><div className="panel-heading"><div><h2>Agent runtime status</h2><p>Configuration is intentionally paused while integrations are on hold.</p></div><span className="status-pill pending">NOT CONFIGURED</span></div><div className="record-details"><span><b>Model provider:</b> Not selected</span><span><b>Agent orchestration:</b> Not deployed</span><span><b>Tool permissions:</b> Disabled</span><span><b>External integrations:</b> Paused by request</span></div><p className="privacy-note">No paid AI service or model has been enabled. We will choose and configure the model only when you are ready.</p></section>:active==="settings"?<section className="panel data-panel"><div className="panel-heading"><div><h2>Workspace settings</h2><p>Private control-plane environment</p></div><span className="status-pill active">SECURE</span></div><div className="record-details"><span><b>Admin access:</b> Supabase Auth + private role check</span><span><b>Database region:</b> Mumbai (ap-south-1)</span><span><b>Client portal:</b> Not enabled</span><span><b>External integrations:</b> Paused</span><span><b>Production website:</b> Not connected or modified</span></div><p className="privacy-note">Admin roles are managed directly in the protected private_admins table. No public role-management controls are exposed.</p></section>:<section className="empty-panel"><div className="empty-symbol">{current.icon}</div><h2>No configuration yet</h2><p>{placeholders[active]?.description} No demo records are shown.</p></section>}
     {active==="businesses"&&<p className="privacy-note">Clients do not receive accounts on Creative Clan. Records are visible only to authorized internal administrators.</p>}
     {active==="connections"&&<p className="privacy-note">Authorization must be granted by the business owner through the platform's official consent flow. Never ask clients to send passwords.</p>}
    </>}
    <footer className="footer"><span>CREATIVE CLAN</span><span>PRIVATE AI BUSINESS AGENT · ADMIN CONTROL PLANE</span></footer>
   </div>
  </section>
 </main>;
}
