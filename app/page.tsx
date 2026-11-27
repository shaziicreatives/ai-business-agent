"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";
import WebsiteUnderstanding from "./website-understanding";

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
 const [browserSession,setBrowserSession]=useState<RowData|null>(null);
 const [approvedBusinesses,setApprovedBusinesses]=useState<RowData[]>([]);
 const [browserBusinessId,setBrowserBusinessId]=useState("");
 const [agentBusinessId,setAgentBusinessId]=useState("");
 const [agentReply,setAgentReply]=useState<RowData|null>(null);
 const [agentBusy,setAgentBusy]=useState(false);
 const [browserBusy,setBrowserBusy]=useState(false);
 const [browserMessage,setBrowserMessage]=useState("");
 const [branding,setBranding]=useState<{login_logo_url:string|null;favicon_url:string|null}>({login_logo_url:null,favicon_url:null});
 const [brandingLogoFile,setBrandingLogoFile]=useState<File|null>(null);
 const [brandingFaviconFile,setBrandingFaviconFile]=useState<File|null>(null);
 const [brandingBusy,setBrandingBusy]=useState(false);
 const [brandingMessage,setBrandingMessage]=useState("");
 const [moduleForm,setModuleForm]=useState<Record<string,string>>({});
 const [moduleBusy,setModuleBusy]=useState(false);
 const [notifyPrefs,setNotifyPrefs]=useState({access_request_email:true,security_alert_email:true,task_completion_email:true,weekly_summary_email:false});
 const [invoiceBusinesses,setInvoiceBusinesses]=useState<RowData[]>([]);
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
   const map:Partial<Record<Section,string>>={requests:"requests",businesses:"businesses",connections:"connections",tasks:"tasks",security:"audit",automations:"automations",credits:"credits",payments:"invoices",support:"support_tickets",team:"team",notifications:"notifications"};
   if(!map[section]){setRows([]);return;}
   setDataBusy(true);setDataError("");
   try{
     const d=await action(map[section]!);setRows(d.data||[]);if(section==="payments")setInvoiceBusinesses(d.businesses||[]);
     if(section==="connections"){const history=await action("panel_scans");setScanHistory(history.data||[]);} if(section==="notifications"){const prefs=await action("notification_settings");setNotifyPrefs(prefs.data);}
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
 async function startSecureBrowser(){
   if(!scanResult?.id||!scanResult?.normalized_url){setBrowserMessage("Open a saved scan report first.");return;}
   if(!browserBusinessId){setBrowserMessage("Select the approved client business for this website first.");return;}
   setBrowserBusy(true);setBrowserMessage("");
   try{
     const {data:{session},error:sessionError}=await supabase.auth.getSession();
     if(sessionError||!session)throw new Error("Your admin session has expired. Please sign in again.");
     const response=await fetch(process.env.NEXT_PUBLIC_API_BASE_URL+"/v1/admin/panel-scan/browser-session",{
       method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
       body:JSON.stringify({url:scanResult.normalized_url,scan_id:scanResult.id,business_id:browserBusinessId})
     });
     const data=await response.json().catch(()=>({}));
     if(!response.ok||!data?.ok)throw new Error(data?.error||"Could not start secure browser.");
     setBrowserSession({...data.data,scan_id:scanResult.id});
     setBrowserMessage("Secure browser is ready. Open Live Browser, sign in yourself, then return here.");
   }catch(e){setBrowserMessage(e instanceof Error?e.message:"Could not start secure browser.");}
   finally{setBrowserBusy(false);}
 }
 async function runAuthenticatedInspection(){
   if(!browserSession?.session_id||!browserSession?.scan_id){setBrowserMessage("Start a secure browser session first.");return;}
   setBrowserBusy(true);setBrowserMessage("");
   try{
     const {data:{session},error:sessionError}=await supabase.auth.getSession();
     if(sessionError||!session)throw new Error("Your admin session has expired. Please sign in again.");
     const response=await fetch(process.env.NEXT_PUBLIC_API_BASE_URL+"/v1/admin/panel-scan/browser-inspect",{
       method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
       body:JSON.stringify({session_id:browserSession.session_id,scan_id:browserSession.scan_id})
     });
     const data=await response.json().catch(()=>({}));
     if(!response.ok||!data?.ok)throw new Error(data?.error||"Read-only inspection failed.");
     setScanResult(data.data);setBrowserSession(null);
     setBrowserMessage("Inspection completed. The updated report has been saved.");
     const history=await action("panel_scans");setScanHistory(history.data||[]);
   }catch(e){setBrowserMessage(e instanceof Error?e.message:"Read-only inspection failed.");}
   finally{setBrowserBusy(false);}
 }
 async function runAgentCommand(){
   const instruction=(moduleForm.instruction||"").trim();
   if(!instruction){setDataError("Write a question or command first.");return;}
   if(!agentBusinessId){setDataError("Select an approved client business first.");return;}
   setAgentBusy(true);setDataError("");setAgentReply(null);
   try{
     const {data:{session},error:sessionError}=await supabase.auth.getSession();
     if(sessionError||!session)throw new Error("Your admin session has expired. Please sign in again.");
     const response=await fetch(process.env.NEXT_PUBLIC_API_BASE_URL+"/v1/agent/command",{
       method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+session.access_token},
       body:JSON.stringify({instruction,business_id:agentBusinessId})
     });
     const data=await response.json().catch(()=>({}));
     if(!response.ok||!data?.ok)throw new Error(data?.error||"AI command failed.");
     setAgentReply(data.data||null);
     await loadSection("tasks");
   }catch(e){setDataError(e instanceof Error?e.message:"AI command failed.");}
   finally{setAgentBusy(false);}
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
 useEffect(()=>{if(adminEmail){void loadOverview();void loadSection(active);action("businesses").then(d=>setApprovedBusinesses((d.data||[]).filter((b:RowData)=>b.status==="active"&&b.website_url))).catch(()=>setApprovedBusinesses([]));}},[adminEmail,active,loadOverview,loadSection,action]);
 useEffect(()=>{
   let mounted=true;
   supabase.from("admin_branding").select("login_logo_url,favicon_url").eq("id",true).maybeSingle().then(({data})=>{
     if(mounted&&data)setBranding({login_logo_url:data.login_logo_url||null,favicon_url:data.favicon_url||null});
   });
   return()=>{mounted=false;};
 },[]);
 useEffect(()=>{
   if(typeof document==="undefined")return;
   const links=document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]');
   if(links.length===0){const link=document.createElement("link");link.rel="icon";document.head.appendChild(link);link.href=faviconUrl;}
   else links.forEach(link=>{link.href=faviconUrl;});
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
 async function submitModule(actionName:string,payload:RowData,refresh:Section){
   setModuleBusy(true);setDataError("");
   try{await action(actionName,payload);setModuleForm({});await loadSection(refresh);await loadOverview();}
   catch(e){setDataError(e instanceof Error?e.message:"Action failed.");}
   finally{setModuleBusy(false);}
 }
 async function review(id:string,decision:"approve"|"decline"){
   setReviewing(id);setDataError("");
   try{await action("review_request",{id,decision,notes:notes[id]||""});await Promise.all([loadSection("requests"),loadOverview()]);}
   catch(e){setDataError(e instanceof Error?e.message:"Review failed.");}finally{setReviewing("");}
 }
 const current=sections.find(s=>s.id===active)!;
 const fmt=(v:unknown)=>v===null||v===undefined||v===""?"—":String(v);
 const date=(v:string)=>v?new Date(v).toLocaleString():"—";
 const live=["requests","businesses","connections","tasks","security","automations","credits","payments","support","team","notifications"].includes(active);

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
 if(!adminEmail)return <main className="auth-screen"><form className="auth-card" onSubmit={login}><img className="auth-logo" src={loginLogoUrl} alt="Login page logo" /><p className="eyebrow">PRIVATE SUPER ADMIN</p><h1>Welcome back</h1><p className="auth-copy">Sign in with your authorized administrator account.</p><label>Email address<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label>{authError&&<p className="auth-error">{authError}</p>}<button className="auth-submit" disabled={busy}>{busy?"Verifying access…":"Sign in securely"}</button><button type="button" className="forgot-link" onClick={()=>void sendPasswordReset()} disabled={busy}>{busy?"Sending…":"Forgot password?"}</button>{recoverySent&&<p className="recovery-success">If this admin email is registered, a password reset link has been sent. Check inbox and spam.</p>}<small>No public signup or client login. Only owner-authorized accounts can enter.</small></form></main>;

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
     {active==="tasks" ? <section className="panel data-panel">
       <div className="panel-heading"><div><span className="panel-kicker">WEBSITE-AWARE AI ASSISTANT</span><h2>Talk to your AI Agent</h2><p>Select an approved client website, ask questions about its inspected structure, or give the agent a task to analyze. Website changes are not enabled yet.</p></div></div>
       <div className="credit-controls">
        <label>Client website<select value={agentBusinessId} onChange={e=>{setAgentBusinessId(e.target.value);setAgentReply(null);}}><option value="">{approvedBusinesses.length?"Choose an approved client business":"No active client businesses available"}</option>{approvedBusinesses.map(b=><option key={b.id} value={b.id}>{b.business_name} — {b.website_url}</option>)}</select></label>
        <label>Your message<textarea value={moduleForm.instruction||""} onChange={e=>setModuleForm(v=>({...v,instruction:e.target.value}))} placeholder="Example: Explain how this website's admin navigation is organized…" rows={4}/></label>
        <button className="primary-action" disabled={agentBusy||!(moduleForm.instruction||"").trim()||!agentBusinessId} onClick={()=>void runAgentCommand()}>{agentBusy?"Thinking…":"Send to AI Agent"}</button>
        {approvedBusinesses.length===0&&<small>No approved active client is registered yet. Approve a client in Businesses and make sure its website URL is saved first.</small>}
       </div>
       {agentReply&&<div className="scan-recommendations"><b>AI Agent response</b><p style={{whiteSpace:"pre-wrap"}}>{agentReply.response}</p><small>{agentReply.model||"AI model"} · {agentReply.business?.name||"Client context"} · {agentReply.context_status||"context status unavailable"} · Reply saved in task history</small></div>}
       <div className="panel-heading"><div><h2>Task & conversation history</h2><p>Saved AI replies and queued instructions</p></div><button className="small-action" onClick={()=>void loadSection("tasks")}>Refresh</button></div>{renderRows()}
      </section> : active==="automations" ? <section className="panel data-panel">
       <div className="panel-heading"><div><h2>Create automation</h2><p>New automations are saved disabled and approval-protected. Execution requires a connected runtime.</p></div></div>
       <div className="credit-controls"><label>Approved business ID<input value={moduleForm.business_id||""} onChange={e=>setModuleForm(v=>({...v,business_id:e.target.value}))} placeholder="Business UUID"/></label><label>Automation name<input value={moduleForm.name||""} onChange={e=>setModuleForm(v=>({...v,name:e.target.value}))} placeholder="e.g. Low stock alert"/></label><label>Trigger<select value={moduleForm.trigger_type||"manual"} onChange={e=>setModuleForm(v=>({...v,trigger_type:e.target.value}))}><option value="manual">Manual</option><option value="schedule">Schedule</option><option value="order_created">Order created</option><option value="inventory_low">Low inventory</option></select></label><button className="primary-action" disabled={moduleBusy||!(moduleForm.name||"").trim()||!(moduleForm.business_id||"").trim()} onClick={()=>void submitModule("create_automation",{business_id:moduleForm.business_id,name:moduleForm.name,trigger_type:moduleForm.trigger_type||"manual",description:"Created from admin console"}, "automations")}>Save automation</button></div>
       <div className="panel-heading"><div><h2>Saved automations</h2><p>Enable/disable definitions; runtime is not yet connected</p></div><button className="small-action" onClick={()=>void loadSection("automations")}>Refresh</button></div>
       <div className="record-list">{rows.map(row=><article className="request-record" key={row.id}><div className="record-top"><div><h3>{row.name}</h3><p>{row.trigger_type} · {row.description||"No description"}</p></div><span className={"status-pill "+(row.is_enabled?"active":"pending")}>{row.is_enabled?"Enabled":"Disabled"}</span></div><div className="review-controls"><button onClick={()=>void submitModule("update_automation",{id:row.id,is_enabled:!row.is_enabled},"automations")}>{row.is_enabled?"Disable":"Enable"}</button></div></article>)}</div>
      </section> : active==="support" ? <section className="panel data-panel">
       <div className="panel-heading"><div><h2>Open support ticket</h2><p>Create and track internal onboarding or support work</p></div></div>
       <div className="credit-controls"><label>Subject<input value={moduleForm.subject||""} onChange={e=>setModuleForm(v=>({...v,subject:e.target.value}))} placeholder="Issue or onboarding request"/></label><label>Priority<select value={moduleForm.priority||"normal"} onChange={e=>setModuleForm(v=>({...v,priority:e.target.value}))}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Details<textarea rows={3} value={moduleForm.message||""} onChange={e=>setModuleForm(v=>({...v,message:e.target.value}))}/></label><button className="primary-action" disabled={moduleBusy||!(moduleForm.subject||"").trim()||!(moduleForm.message||"").trim()} onClick={()=>void submitModule("create_support_ticket",{subject:moduleForm.subject,message:moduleForm.message,priority:moduleForm.priority||"normal"},"support")}>Create ticket</button></div>
       <div className="panel-heading"><div><h2>Support queue</h2></div><button className="small-action" onClick={()=>void loadSection("support")}>Refresh</button></div>
       <div className="record-list">{rows.map(row=><article className="request-record" key={row.id}><div className="record-top"><div><h3>{row.subject}</h3><p>{row.priority} priority · {date(row.created_at)}</p></div><span className={"status-pill "+row.status}>{row.status}</span></div><p>{row.message}</p><div className="review-controls"><select value={row.status} onChange={e=>void submitModule("update_support_ticket",{id:row.id,status:e.target.value},"support")}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></div></article>)}</div>
      </section> : active==="payments" ? <section className="panel data-panel">
       <div className="panel-heading"><div><h2>New invoice</h2><p>Invoice number is assigned automatically. No need to type it.</p></div></div>
       <div className="credit-controls"><label>Customer / business<select value={moduleForm.business_id||""} onChange={e=>setModuleForm(v=>({...v,business_id:e.target.value}))}><option value="">General / walk-in customer</option>{invoiceBusinesses.map(b=><option key={b.id} value={b.id}>{b.business_name}{b.owner_name?" — "+b.owner_name:""}</option>)}</select></label><label>Invoice details<input value={moduleForm.description||""} onChange={e=>setModuleForm(v=>({...v,description:e.target.value}))} placeholder="e.g. Monthly AI service"/></label><label>Amount (PKR)<input type="number" min="1" value={moduleForm.amount||""} onChange={e=>setModuleForm(v=>({...v,amount:e.target.value}))} placeholder="0"/></label><label>Due date<input type="date" value={moduleForm.due_date||""} onChange={e=>setModuleForm(v=>({...v,due_date:e.target.value}))}/></label><button className="primary-action" disabled={moduleBusy||!(moduleForm.description||"").trim()||!moduleForm.amount||Number(moduleForm.amount)<=0} onClick={()=>void submitModule("create_invoice",{business_id:moduleForm.business_id||null,description:moduleForm.description,amount:Number(moduleForm.amount),due_date:moduleForm.due_date||null},"payments")}>{moduleBusy?"Saving…":"Create invoice"}</button></div>
       <div className="panel-heading"><div><h2>Invoices</h2><p>Newest invoice numbers are generated in order.</p></div><button className="small-action" onClick={()=>void loadSection("payments")}>Refresh</button></div>
       <div className="record-list">{rows.map(row=><article className="request-record" key={row.id}><div className="record-top"><div><h3>{row.invoice_number}</h3><p>{row.business_name||"General customer"} · {row.description} · PKR {Number(row.amount).toLocaleString()}</p></div><span className={"status-pill "+row.status}>{row.status}</span></div><div className="review-controls"><select value={row.status} onChange={e=>void submitModule("update_invoice",{id:row.id,status:e.target.value},"payments")}><option value="draft">Draft</option><option value="issued">Issued</option><option value="paid">Paid</option><option value="overdue">Overdue</option><option value="void">Void</option></select></div></article>)}</div>
      </section> : active==="team" ? <section className="panel data-panel">
       <div className="panel-heading"><div><h2>Invite administrator</h2><p>Invitations send an email. Only Admin and Operator roles can be invited here.</p></div></div>
       <div className="credit-controls"><label>Email<input type="email" value={moduleForm.email||""} onChange={e=>setModuleForm(v=>({...v,email:e.target.value}))} placeholder="team@example.com"/></label><label>Role<select value={moduleForm.role||"operator"} onChange={e=>setModuleForm(v=>({...v,role:e.target.value}))}><option value="operator">Operator</option><option value="admin">Admin</option></select></label><button className="primary-action" disabled={moduleBusy||!(moduleForm.email||"").trim()} onClick={()=>void submitModule("invite_team_member",{email:moduleForm.email,role:moduleForm.role||"operator"},"team")}>Send invitation</button></div>
       <div className="panel-heading"><div><h2>Team access</h2><p>Owner access cannot be disabled from this screen</p></div><button className="small-action" onClick={()=>void loadSection("team")}>Refresh</button></div>
       <div className="record-list">{rows.map(row=><article className="request-record" key={row.id}><div className="record-top"><div><h3>{row.email}</h3><p>{row.role} · Added {date(row.created_at)}</p></div><span className={"status-pill "+(row.is_active?"active":"revoked")}>{row.is_active?"Active":"Disabled"}</span></div>{row.role!=="owner"&&<div className="review-controls"><select value={row.role} onChange={e=>void submitModule("update_team_member",{id:row.id,role:e.target.value,is_active:row.is_active},"team")}><option value="operator">Operator</option><option value="admin">Admin</option></select><button className="danger-action" onClick={()=>void submitModule("update_team_member",{id:row.id,role:row.role,is_active:!row.is_active},"team")}>{row.is_active?"Disable":"Enable"}</button></div>}</article>)}</div>
      </section> : active==="notifications" ? <section className="panel data-panel">
       <div className="panel-heading"><div><h2>Notification preferences</h2><p>Save which alert categories should be enabled. Email delivery requires a mail provider.</p></div><button className="small-action" onClick={()=>void loadSection("notifications")}>Refresh</button></div>
       <div className="record-list">{Object.entries({access_request_email:"Access request alerts",security_alert_email:"Security alerts",task_completion_email:"Task completion alerts",weekly_summary_email:"Weekly summary"}).map(([key,label])=><label className="review-controls" key={key}><input type="checkbox" checked={Boolean((notifyPrefs as any)[key])} onChange={e=>setNotifyPrefs(v=>({...v,[key]:e.target.checked}))}/>{label}</label>)}</div>
       <button className="primary-action" onClick={()=>void submitModule("save_notification_settings",notifyPrefs,"notifications")}>Save preferences</button>
       <div className="panel-heading"><h2>Recent notifications</h2></div><div className="record-list">{rows.map(row=><article className="request-record" key={row.id}><h3>{row.title}</h3><p>{row.message}</p><small>{date(row.created_at)}</small>{!row.is_read&&<button onClick={()=>void submitModule("mark_notification_read",{id:row.id},"notifications")}>Mark read</button>}</article>)}</div>
      </section> : active==="connections" ? <>
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
        {scanResult.recommended_method==="secure_browser"&&<div className="scan-recommendations">
         <b>Secure browser inspection</b>
         <p>Open a temporary Cloudflare browser, sign in yourself, then run a read-only check. The agent will not click buttons, submit forms or collect field values.</p>
         {!browserSession?<><label className="browser-business-select">Approved client business<select value={browserBusinessId} onChange={e=>setBrowserBusinessId(e.target.value)}><option value="">{approvedBusinesses.length?"Choose the client linked to this website":"No active client businesses available"}</option>{approvedBusinesses.map(b=><option key={b.id} value={b.id}>{b.business_name} — {b.website_url}</option>)}</select></label><button type="button" className="primary-action" disabled={browserBusy||!scanResult.id||!browserBusinessId} onClick={()=>void startSecureBrowser()}>{browserBusy?"Starting browser…":"Start secure browser"}</button>
          {approvedBusinesses.length===0&&<small>No approved active client is available. Approve a client business first.</small>}</>:<>
          <p><a href={browserSession.live_view_url} target="_blank" rel="noreferrer">Open Live Browser to sign in</a></p>
          <p>After you finish signing in, return to this page.</p>
          <button type="button" className="primary-action" disabled={browserBusy} onClick={()=>void runAuthenticatedInspection()}>{browserBusy?"Inspecting…":"I have logged in — inspect now"}</button>
         </>}
         {browserMessage&&<p role="status">{browserMessage}</p>}
        </div>}
        {scanResult.scan_report?.browser_inspection&&<div className="scan-findings">
         <b>Authenticated inspection result</b>
         <p>Inspected: {date(scanResult.scan_report.browser_inspection.inspected_at)}</p>
         <p>Page: {scanResult.scan_report.browser_inspection.title||"No title"} · {scanResult.scan_report.browser_inspection.url||""}</p>
         <p>Headings: {scanResult.scan_report.browser_inspection.headings?.length||0} · Links: {scanResult.scan_report.browser_inspection.links?.length||0} · Forms: {scanResult.scan_report.browser_inspection.forms?.length||0} · Buttons: {scanResult.scan_report.browser_inspection.buttons?.length||0}</p>
         <p>No buttons clicked. No forms submitted. No field values collected.</p>
        </div>}
        <p className="scan-disclaimer">Important: this first scan is unauthenticated and read-only. It does not prove that private Admin Panel actions or browser automation will work. A secure logged-in browser test is a separate next stage.</p>
       </section>}
      </section>
      <WebsiteUnderstanding />
      {scanHistory.length>0&&<section className="panel scan-history-panel"><div className="panel-heading"><div><h2>Recent compatibility scans</h2><p>Private scan history for this admin account</p></div><button className="small-action" onClick={()=>void loadSection("connections")}>Refresh</button></div><div className="scan-history-list">{scanHistory.map(item=><article key={item.id} className="scan-history-record"><div><b>{item.normalized_url}</b><small>{date(item.created_at)} · {String(item.confidence||"low").toUpperCase()} confidence · HTTP {item.http_status||"—"}</small></div><div className="scan-history-actions"><span className="status-pill active">{item.recommended_method==="api"?"API candidate":item.recommended_method==="secure_browser"?"Browser inspection":item.recommended_method==="additional_access"?"Additional access":"Manual review"}</span><button type="button" className="small-action" onClick={()=>setScanResult(item)}>View report</button></div></article>)}</div></section>}
      <section className="panel data-panel"><div className="panel-heading"><div><h2>Existing authorized connections</h2><p>Previously authorized integrations. A scan alone never marks a website as connected.</p></div><button className="small-action" onClick={()=>void loadSection("connections")}>Refresh</button></div>{renderRows()}</section>
     </> : live ? renderRows() : active==="settings" ? <>
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
