"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
const sections = [
  { id:"overview",label:"Overview",icon:"▦",group:"Workspace" },
  { id:"businesses",label:"Businesses",icon:"♙",group:"Workspace" },
  { id:"requests",label:"Access requests",icon:"↗",group:"Workspace" },
  { id:"connections",label:"Admin Panel Scanner",icon:"⌁",group:"Workspace" },
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
const titles: Partial<Record<Section,string>> = { credits:"Usage & Credits",requests:"Access requests",businesses:"Businesses",connections:"Admin Panel Scanner",tasks:"Task history",security:"Security & audit logs",automations:"Automations" };

export default function Home(){
 const [active,setActive]=useState<Section>("overview"),[email,setEmail]=useState(""),[password,setPassword]=useState("");
 const [adminEmail,setAdminEmail]=useState(""),[authError,setAuthError]=useState(""),[busy,setBusy]=useState(false),[checking,setChecking]=useState(true);
 const [recoveryMode,setRecoveryMode]=useState(false),[recoverySent,setRecoverySent]=useState(false),[recoveryPassword,setRecoveryPassword]=useState(""),[recoveryConfirm,setRecoveryConfirm]=useState("");
 const [counts,setCounts]=useState(blankCounts),[rows,setRows]=useState<RowData[]>([]),[dataBusy,setDataBusy]=useState(false),[dataError,setDataError]=useState("");
 const [notes,setNotes]=useState<Record<string,string>>({}),[reviewing,setReviewing]=useState("");
 const [creditInputs,setCreditInputs]=useState<Record<string,{quota:string,amount:string,reason:string}>>({}),[creditBusy,setCreditBusy]=useState("");
 const [creditHistory,setCreditHistory]=useState<Record<string,RowData[]>>({});
 const [previewOpen,setPreviewOpen]=useState(false);
 const [scanUrl,setScanUrl]=useState("");
 const [scanBusy,setScanBusy]=useState(false);
 const [scanResult,setScanResult]=useState<RowData|null>(null);
 const [scanHistory,setScanHistory]=useState<RowData[]>([]);
 const [branding,setBranding]=useState<{login_logo_url:string|null;favicon_url:string|null}>({login_logo_url:null,favicon_url:null});
 const [brandingLogoFile,setBrandingLogoFile]=useState<File|null>(null);
 const [brandingFaviconFile,setBrandingFaviconFile]=useState<File|null>(null);
 const [brandingBusy,setBrandingBusy]=useState(false);
 const [brandingMessage,setBrandingMessage]=useState("");
 const loginLogoUrl=branding.login_logo_url||"/creative-clan-logo-transparent.svg";
 const faviconUrl=branding.favicon_url||"/favicon.svg";

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
   try{
     const d=await action(map[section]!);setRows(d.data||[]);
     if(section==="connections"){const history=await action("panel_scans");setScanHistory(history.data||[]);}
   }catch(e){setRows([]);setDataError(e instanceof Error?e.message:"Could not load records.");}
   finally{setDataBusy(false);}
 },[action]);
 async function runPanelScan(){
   setScanBusy(true);setDataError("");setScanResult(null);
   try{
     const {data:{session},error:sessionError}=await supabase.auth.getSession();
     if(sessionError||!session)throw new Error("Your admin session has expired. Please sign in again.");
     const response=await fetch(process.env.NEXT_PUBLIC_API_BASE_URL+"/v1/admin/panel-scan",{
       method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
       body:JSON.stringify({url:scanUrl.trim()})
     });
     const data=await response.json().catch(()=>({}));
     if(!response.ok||!data?.ok)throw new Error(data?.error||"Compatibility scan failed.");
     setScanResult(data.data);
     const history=await action("panel_scans");setScanHistory(history.data||[]);
   }catch(e){setDataError(e instanceof Error?e.message:"Compatibility scan failed.");}
   finally{setScanBusy(false);}
 }
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
 useEffect(()=>{
   let mounted=true;
   supabase.from("admin_branding").select("login_logo_url,favicon_url").eq("id",true).maybeSingle().then(({data})=>{
     if(mounted&&data)setBranding({login_logo_url:data.login_logo_url||null,favicon_url:data.favicon_url||null});
   });
   return()=>{mounted=false;};
 },[]);
 useEffect(()=>{
   if(typeof document==="undefined")return;
   let link=document.querySelector<HTMLLinkElement>('link[rel="icon"]');
   if(!link){link=document.createElement("link");link.rel="icon";document.head.appendChild(link);}
   link.href=faviconUrl;
 },[faviconUrl]);
 async function saveBranding(){
   setBrandingBusy(true);setBrandingMessage("");
   try{
     const next={...branding};
     const uploads:[File|null,"login-logo"|"favicon"][]=[[brandingLogoFile,"login-logo"],[brandingFaviconFile,"favicon"]];
     for(const [file,kind] of uploads){
       if(!file)continue;
       if(file.size>2*1024*1024)throw new Error("Each image must be 2 MB or smaller.");
       const allowed=["image/png","image/jpeg","image/webp","image/svg+xml","image/x-icon","image/vnd.microsoft.icon"];
       if(!allowed.includes(file.type))throw new Error("Use PNG, JPG, WEBP, SVG or ICO image files.");
       const ext=(file.name.split(".").pop()||"png").toLowerCase();
       const path=`brand-assets/${kind}-${Date.now()}-${crypto.randomUUID()}.${ext}`;
       const {error:uploadError}=await supabase.storage.from("admin-branding").upload(path,file,{contentType:file.type,cacheControl:"3600",upsert:false});
       if(uploadError)throw uploadError;
       const {data}=supabase.storage.from("admin-branding").getPublicUrl(path);
       if(kind==="login-logo")next.login_logo_url=data.publicUrl;else next.favicon_url=data.publicUrl;
     }
     const result=await action("save_branding",next);
     setBranding({login_logo_url:result.data.login_logo_url||null,favicon_url:result.data.favicon_url||null});
     setBrandingLogoFile(null);setBrandingFaviconFile(null);
     const logoInput=document.getElementById("branding-login-logo") as HTMLInputElement|null;
     const iconInput=document.getElementById("branding-favicon") as HTMLInputElement|null;
     if(logoInput)logoInput.value="";if(iconInput)iconInput.value="";
     setBrandingMessage("Branding saved and applied successfully.");
   }catch(e){setBrandingMessage(e instanceof Error?e.message:"Could not save branding.");}
   finally{setBrandingBusy(false);}
 }

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
 const live=["requests","businesses","connections","tasks","security","automations","credits"].includes(active);

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
     <div className="credit-history-action"><button className="text-action" onClick={()=>void (async()=>{try{const result=await action("credit_history",{business_id:row.business_id});setCreditHistory(old=>({...old,[row.business_id]:result.data||[]}));}catch(e){setDataError(e instanceof Error?e.message:"Could not load credit history.");}})()}>View credit history</button></div>
     {creditHistory[row.business_id]&&<div className="credit-history"><b>Recent credit activity</b>{creditHistory[row.business_id].length===0?<small>No ledger entries yet.</small>:creditHistory[row.business_id].map(entry=><div key={entry.id}><span>{entry.entry_type.replace("_"," ")} · {entry.reason}</span><strong className={entry.amount<0?"negative-credit":"positive-credit"}>{entry.amount>0?"+":""}{Number(entry.amount).toLocaleString()}</strong><small>{date(entry.created_at)} · Balance {Number(entry.balance_after).toLocaleString()}</small></div>)}</div>}
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

 if(checking)return <main className="auth-screen"><div className="auth-card"><img className="auth-logo" src={loginLogoUrl} alt="Login page logo" /><p>Checking private access…</p></div></main>;
 if(recoveryMode)return <main className="auth-screen"><form className="auth-card" onSubmit={saveNewPassword}><img className="auth-logo" src={loginLogoUrl} alt="Login page logo" /><p className="eyebrow">ACCOUNT RECOVERY</p><h1>Set a new password</h1><p className="auth-copy">Choose a new password for your private admin account.</p><label>New password<input type="password" autoComplete="new-password" value={recoveryPassword} onChange={e=>setRecoveryPassword(e.target.value)} minLength={8} required/></label><label>Confirm new password<input type="password" autoComplete="new-password" value={recoveryConfirm} onChange={e=>setRecoveryConfirm(e.target.value)} minLength={8} required/></label>{authError&&<p className="auth-error">{authError}</p>}<button className="auth-submit" disabled={busy}>{busy?"Updating password…":"Save new password"}</button></form></main>;
 if(!adminEmail)return <main className="auth-screen"><form className="auth-card" onSubmit={login}><img className="auth-logo" src="/creative-clan-logo-transparent.svg" alt="Creative Clan — Social Media & Marketing Agency" /><p className="eyebrow">PRIVATE SUPER ADMIN</p><h1>Welcome back</h1><p className="auth-copy">Sign in with your authorized administrator account.</p><label>Email address<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{authError&&<p className="auth-error">{authError}</p>}<button className="auth-submit" disabled={busy}>{busy?"Verifying access…":"Sign in securely"}</button><button type="button" className="forgot-link" onClick={()=>void sendPasswordReset()} disabled={busy}>{busy?"Sending…":"Forgot password?"}</button>{recoverySent&&<p className="recovery-success">If this admin email is registered, a password reset link has been sent. Check inbox and spam.</p>}<small>No public signup or client login. Only owner-authorized accounts can enter.</small></form></main>;

 return <main className="admin-shell">
  <aside className="sidebar"><a className="brand" href="#" onClick={e=>{e.preventDefault();setActive("overview");}}><img className="sidebar-logo" src={faviconUrl} alt="Creative Clan" /><span className="brand-name">Creative <b>Clan</b><small>PRIVATE ADMIN CONSOLE</small></span></a>{(["Workspace","Business Operations","Administration"] as const).map(group=><div className="nav-group" key={group}><div className="nav-caption">{group}</div><nav className="side-nav" aria-label={group}>{sections.filter(s=>s.group===group).map(s=><button key={s.id} className={active===s.id?"nav-link active":"nav-link"} onClick={()=>setActive(s.id)}><span className="nav-icon">{s.icon}</span><span>{s.label}</span>{s.id==="requests"&&<span className="nav-count">{counts.pending_requests}</span>}</button>)}</nav></div>)}<div className="sidebar-bottom"><div className="secure-mark">◇</div><div><b>Private workspace</b><small>Owner access only</small></div><span className="secure-dot"/></div></aside>
  <section className="main-area"><header className="topbar"><div className="breadcrumbs"><span>Creative Clan</span><i>/</i>{current.label}</div><div className="topbar-right"><span className="environment"><i/> PRIVATE ADMIN</span><span className="admin-email">{adminEmail}</span><button className="logout-button" onClick={()=>supabase.auth.signOut()}>Sign out</button></div></header>
   <div className="content">
    {active==="overview"?<>
     <div className="welcome-strip"><div><p className="eyebrow">PRIVATE SUPER ADMIN · OWNER WORKSPACE</p><h1>Welcome back, Shawaiz.</h1><p className="subheading">Your Creative Clan command center is ready. Here is the current status of your platform.</p></div><div className="welcome-actions"><span className="live-pill"><i/> SECURE SESSION ACTIVE</span><button className="primary-action" onClick={()=>setActive("requests")}>＋ New access request</button></div></div>
     <div className="overview-toolbar"><div><span className="toolbar-kicker">PLATFORM OVERVIEW</span><b>Live system snapshot</b><small>Figures are read from your secured backend, not demo data.</small></div><button className="small-action" onClick={()=>void loadOverview()}>↻ Refresh data</button></div>
     <div className="stats-grid"><article className="stat-card stat-blue"><div className="stat-top"><span>Authorized businesses</span><span className="stat-icon">♙</span></div><strong>{counts.businesses.toString().padStart(2,"0")}</strong><small>Approved access records</small><div className="stat-foot">LIVE DATABASE COUNT</div></article><article className="stat-card stat-violet"><div className="stat-top"><span>Website connections</span><span className="stat-icon">⌁</span></div><strong>{counts.connections.toString().padStart(2,"0")}</strong><small>Authorized platform connections</small><div className="stat-foot">LIVE DATABASE COUNT</div></article><article className="stat-card stat-cyan"><div className="stat-top"><span>Pending requests</span><span className="stat-icon">↗</span></div><strong>{counts.pending_requests.toString().padStart(2,"0")}</strong><small>Awaiting your review</small><div className="stat-foot">REQUIRES ATTENTION</div></article><article className="stat-card stat-amber"><div className="stat-top"><span>Agent tasks</span><span className="stat-icon">✳</span></div><strong>{counts.tasks.toString().padStart(2,"0")}</strong><small>Recorded task history</small><div className="stat-foot">LIVE DATABASE COUNT</div></article></div>
     {dataError&&<p className="data-error">{dataError}</p>}
     <div className="dashboard-grid"><section className="panel modules-panel"><div className="panel-heading"><div><span className="panel-kicker">WORKSPACE</span><h2>Platform modules</h2><p>Jump straight into a control area</p></div><span className="module-count">14 MODULES</span></div><div className="module-grid">{sections.slice(1).map(s=><button key={s.id} className="module-tile" onClick={()=>setActive(s.id)}><span className="module-icon">{s.icon}</span><span className="module-tile-text">{s.label}</span><span className="module-arrow">↗</span></button>)}</div></section>
     <section className="panel activity-panel"><div className="panel-heading"><div><span className="panel-kicker">SYSTEM STATUS</span><h2>Control plane health</h2><p>Current configuration state</p></div><span className="health-orb">✓</span></div><div className="health-list"><div><span className="health-symbol green">✓</span><span><b>Admin authentication</b><small>Private owner session verified</small></span><em>ACTIVE</em></div><div><span className="health-symbol green">✓</span><span><b>Secure backend</b><small>Protected admin API configured</small></span><em>CONNECTED</em></div><div><span className="health-symbol blue">◇</span><span><b>External integrations</b><small>Waiting for your authorization</small></span><em>PAUSED</em></div><div><span className="health-symbol amber">ϟ</span><span><b>AI runtime</b><small>Cloudflare Workers AI configured · business tools not connected</small></span><em>CONFIGURED</em></div></div><div className="architecture-mini"><b>Platform architecture</b><div><span>Client platform</span><i>↔</i><span>AI agent</span><i>↔</i><span>Admin</span></div><small>Client data stays on its original platform · Permission-based access · Admin approvals</small></div></section></div>
     <div className="bottom-dashboard-grid"><section className="panel quick-panel"><div className="panel-heading"><div><span className="panel-kicker">QUICK ACCESS</span><h2>Pending access requests</h2><p>Review incoming business applications</p></div><button className="text-action" onClick={()=>setActive("requests")}>View all →</button></div><div className="quick-empty"><span>↗</span><div><b>{counts.pending_requests===0?"You're all caught up.":`${counts.pending_requests} request(s) need review.`}</b><small>{counts.pending_requests===0?"No pending requests are currently recorded.":"Open access requests to review and decide."}</small></div></div></section><section className="panel principle-panel"><span className="principle-icon">◇</span><div><span className="panel-kicker">CORE PRINCIPLE</span><h2>Your clients keep their own platforms.</h2><p>AI works through approved connections. Their Shopify or website remains the source of truth — no duplicate inventory system.</p></div></section></div>
    </>:<>
     <div className="page-heading"><div><p className="eyebrow">{live?"LIVE ADMIN DATA":"AGENT CONFIGURATION"}</p><h1>{titles[active]||placeholders[active]?.title}</h1><p className="subheading">{active==="requests"?"Review business requests and approve or decline access.":active==="businesses"?"Internal records of approved businesses. No client portal or login is created.":active==="connections"?"Paste an Admin Panel URL to inspect public compatibility signals and get a recommended connection route.":active==="tasks"?"Review internal task history and execution states.":active==="security"?"Internal administrator actions and audit trail.":active==="automations"?"Review automation definitions stored in the control plane. Execution remains disabled until the agent runtime is configured.":placeholders[active]?.description}</p></div><span className="date-label">PRIVATE ADMIN AREA</span></div>
     {dataError&&<p className="data-error">{dataError}</p>}
     {active==="connections" ? <>
      <section className="panel scanner-panel">
       <div className="scanner-intro">
        <div><span className="panel-kicker">ADMIN PANEL COMPATIBILITY</span><h2>Check a client's existing Admin Panel</h2><p>Paste the Admin Panel URL. The scanner checks public technical signals and recommends the next connection route.</p></div>
        <span className="scanner-mark">⌕</span>
       </div>
       <form className="scanner-form" onSubmit={e=>{e.preventDefault();void runPanelScan();}}>
        <label>Admin Panel URL<input type="url" value={scanUrl} onChange={e=>setScanUrl(e.target.value)} placeholder="https://clientwebsite.com/admin" required autoComplete="url"/></label>
        <button className="primary-action" type="submit" disabled={scanBusy||!scanUrl.trim()}>{scanBusy?"Scanning…":"Scan compatibility"}</button>
       </form>
       <div className="scanner-safety"><span>SECURE PASSIVE CHECK</span><p>HTTPS only · GET requests only · No login, password, OTP or cookies are collected · No changes are made to the client's website.</p></div>
       {scanResult&&<section className="scan-result">
        <div className="scan-result-heading"><div><span className="panel-kicker">SCAN REPORT</span><h3>{scanResult.scan_report?.page_title||scanResult.normalized_url}</h3><p>{scanResult.detected_stack||"Software not identified"}</p></div><span className={"status-pill "+(scanResult.scan_status==="completed"?"active":"pending")}>{scanResult.scan_status}</span></div>
        <div className="scan-metrics">
         <div><small>Recommended route</small><b>{scanResult.recommended_method==="api"?"API candidate":scanResult.recommended_method==="secure_browser"?"Secure browser inspection":scanResult.recommended_method==="additional_access"?"Additional access":"Manual review"}</b></div>
         <div><small>Confidence</small><b>{String(scanResult.confidence||"low").toUpperCase()}</b></div>
         <div><small>HTTP response</small><b>{scanResult.http_status||"—"}</b></div>
        </div>
        <div className="scan-findings"><b>What the scanner found</b>{(scanResult.findings||[]).map((item:RowData,index:number)=><div key={index}><span className={"finding-dot "+String(item.status||"")}></span><span><strong>{item.label}</strong><small>{item.detail}</small></span></div>)}</div>
        <div className="scan-recommendations"><b>Recommended next steps</b><ul>{(scanResult.recommendations||[]).map((item:string,index:number)=><li key={index}>{item}</li>)}</ul></div>
        <p className="scan-disclaimer">Important: this first scan is unauthenticated and read-only. It does not prove that private Admin Panel actions or browser automation will work. A secure logged-in browser test is a separate next stage.</p>
       </section>}
      </section>
      {scanHistory.length>0&&<section className="panel scan-history-panel"><div className="panel-heading"><div><h2>Recent compatibility scans</h2><p>Private scan history for this admin account</p></div><button className="small-action" onClick={()=>void loadSection("connections")}>Refresh</button></div><div className="scan-history-list">{scanHistory.map(item=><article key={item.id}><div><b>{item.normalized_url}</b><small>{date(item.created_at)} · {String(item.confidence||"low").toUpperCase()} confidence</small></div><span className="status-pill active">{item.recommended_method==="api"?"API candidate":item.recommended_method==="secure_browser"?"Browser inspection":"Manual review"}</span></article>)}</div></section>}
      <section className="panel data-panel"><div className="panel-heading"><div><h2>Existing authorized connections</h2><p>Previously authorized integrations. A scan alone never marks a website as connected.</p></div><button className="small-action" onClick={()=>void loadSection("connections")}>Refresh</button></div>{renderRows()}</section>
     </> : active==="tasks" ? renderRows() : live ? renderRows() : active==="settings" ? <>
      <section className="panel data-panel branding-panel">
       <div className="panel-heading"><div><span className="panel-kicker">BRAND IDENTITY</span><h2>Branding & appearance</h2><p>Customize the logo shown on your login screen and the icon shown in browser tabs.</p></div><span className="status-pill active">OWNER CONTROL</span></div>
       <div className="branding-grid">
        <article className="branding-card">
         <div><h3>Login page logo</h3><p>Recommended: transparent PNG, SVG or WEBP. Maximum 2 MB.</p></div>
         <div className="branding-preview login-brand-preview"><img src={brandingLogoFile?URL.createObjectURL(brandingLogoFile):loginLogoUrl} alt="Login logo preview"/></div>
         <label className="branding-upload">Choose logo<input id="branding-login-logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e=>setBrandingLogoFile(e.target.files?.[0]||null)}/></label>
        </article>
        <article className="branding-card">
         <div><h3>Browser favicon</h3><p>Recommended: square PNG, WEBP, SVG or ICO. Maximum 2 MB.</p></div>
         <div className="branding-preview favicon-brand-preview"><img src={brandingFaviconFile?URL.createObjectURL(brandingFaviconFile):faviconUrl} alt="Favicon preview"/></div>
         <label className="branding-upload">Choose favicon<input id="branding-favicon" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon" onChange={e=>setBrandingFaviconFile(e.target.files?.[0]||null)}/></label>
        </article>
       </div>
       <div className="branding-actions"><button className="primary-action" disabled={brandingBusy||(!brandingLogoFile&&!brandingFaviconFile)} onClick={()=>void saveBranding()}>{brandingBusy?"Uploading & saving…":"Save & apply branding"}</button><span>{brandingMessage||"Your current logo and favicon stay active until you save new files."}</span></div>
       <div className="record-details"><span><b>Login logo:</b> {branding.login_logo_url?"Custom logo active":"Creative Clan default"}</span><span><b>Favicon:</b> {branding.favicon_url?"Custom favicon active":"Creative Clan default"}</span><span><b>Storage:</b> Supabase public branding bucket · Admin-only uploads</span></div>
      </section>
      <section className="panel data-panel"><div className="panel-heading"><div><h2>Workspace settings</h2><p>Private control-plane environment</p></div><span className="status-pill active">SECURE</span></div><div className="record-details"><span><b>Admin access:</b> Supabase Auth + private role check</span><span><b>Database region:</b> Mumbai (ap-south-1)</span><span><b>Client portal:</b> Not enabled</span><span><b>External integrations:</b> Paused</span><span><b>Production website:</b> Not connected or modified</span></div><p className="privacy-note">Admin roles are managed directly in the protected private_admins table. No public role-management controls are exposed.</p></section>
     </> : <section className="empty-panel"><div className="empty-symbol">{current.icon}</div><h2>No configuration yet</h2><p>{placeholders[active]?.description} No demo records are shown.</p></section>}
    {active==="businesses"&&<p className="privacy-note">Clients do not receive accounts on Creative Clan. Records are visible only to authorized internal administrators.</p>}
    </>}
    <footer className="footer"><span>CREATIVE CLAN</span><span>PRIVATE AI BUSINESS AGENT · ADMIN CONTROL PLANE</span></footer>
   </div>
  </section>
 </main>;
}
