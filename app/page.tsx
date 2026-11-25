"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
const sections = [
  { id: "overview", label: "Overview", icon: "⌂" },
  { id: "requests", label: "Access requests", icon: "⇥" },
  { id: "businesses", label: "Authorized businesses", icon: "▦" },
  { id: "connections", label: "Website connections", icon: "↔" },
  { id: "ai", label: "AI control center", icon: "✧" },
  { id: "automations", label: "Automations", icon: "⟳" },
  { id: "tasks", label: "Task center", icon: "☷" },
  { id: "usage", label: "Usage & costs", icon: "◷" },
  { id: "security", label: "Audit & security", icon: "◇" },
  { id: "settings", label: "Settings", icon: "⚙" },
] as const;
type SectionId = (typeof sections)[number]["id"];
type Row = Record<string, any>;
type Counts = { pending_requests: number; businesses: number; connections: number; tasks: number };
const emptyCounts: Counts = { pending_requests: 0, businesses: 0, connections: 0, tasks: 0 };

const emptyStates: Record<Exclude<SectionId, "overview" | "requests" | "businesses" | "connections" | "tasks" | "security">, { eyebrow: string; title: string; description: string; note: string }> = {
  ai: { eyebrow: "AGENT CONFIGURATION", title: "AI control center", description: "Configure the model provider, agent instructions, available tools, permission boundaries and approval rules.", note: "No AI model or provider is connected yet." },
  automations: { eyebrow: "WORKFLOWS", title: "Automations", description: "Manage event-driven workflows that run only against businesses with valid, authorized connections.", note: "No automations have been configured yet." },
  usage: { eyebrow: "OBSERVABILITY", title: "Usage & costs", description: "Track model usage, platform usage, execution volume and infrastructure costs.", note: "Usage reporting will appear after integrations are connected." },
  settings: { eyebrow: "SYSTEM", title: "Settings", description: "Manage private admin access, system preferences, integration defaults and operational safeguards.", note: "Private administrator access is active." },
};

export default function Home() {
  const [active, setActive] = useState<SectionId>("overview");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [counts, setCounts] = useState<Counts>(emptyCounts);
  const [rows, setRows] = useState<Row[]>([]);
  const [dataBusy, setDataBusy] = useState(false);
  const [dataError, setDataError] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState("");

  const adminAction = useCallback(async (action: string, extra: Row = {}) => {
    const { data, error } = await supabase.functions.invoke("admin-console", { body: { action, ...extra } });
    if (error || !data?.ok) throw new Error(data?.error || error?.message || "Admin request failed.");
    return data;
  }, []);

  const loadOverview = useCallback(async () => {
    try {
      const data = await adminAction("overview");
      setCounts(data.counts);
    } catch (e) { setDataError(e instanceof Error ? e.message : "Could not load overview."); }
  }, [adminAction]);

  const loadSection = useCallback(async (section: SectionId) => {
    const actionBySection: Partial<Record<SectionId, string>> = {
      requests: "requests", businesses: "businesses", connections: "connections", tasks: "tasks", security: "audit",
    };
    const action = actionBySection[section];
    if (!action) { setRows([]); return; }
    setDataBusy(true); setDataError("");
    try {
      const data = await adminAction(action);
      setRows(data.data || []);
    } catch (e) {
      setRows([]);
      setDataError(e instanceof Error ? e.message : "Could not load this section.");
    } finally { setDataBusy(false); }
  }, [adminAction]);

  async function checkAdmin(token: string) {
    const { data, error } = await supabase.functions.invoke("admin-verify", {
      headers: { Authorization: "Bearer " + token }, body: {},
    });
    if (error || !data?.authorized) {
      await supabase.auth.signOut();
      throw new Error("This account is not authorized for the private admin panel.");
    }
    setAdminEmail(data.email || "");
  }

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        try { await checkAdmin(data.session.access_token); }
        catch (e) { if (mounted) setAuthError(e instanceof Error ? e.message : "Access check failed."); }
      }
      if (mounted) setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) { if (mounted) setAdminEmail(""); return; }
      try { await checkAdmin(session.access_token); }
      catch (e) { if (mounted) setAuthError(e instanceof Error ? e.message : "Access check failed."); }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (adminEmail) {
      void loadOverview();
      void loadSection(active);
    }
  }, [adminEmail, active, loadOverview, loadSection]);

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setAuthError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw new Error(error?.message || "Sign in failed.");
      await checkAdmin(data.session.access_token);
    } catch (e) { setAuthError(e instanceof Error ? e.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }

  async function reviewRequest(id: string, decision: "approve" | "decline") {
    setReviewing(id); setDataError("");
    try {
      await adminAction("review_request", { id, decision, notes: reviewNotes[id] || "" });
      await Promise.all([loadSection("requests"), loadOverview()]);
    } catch (e) { setDataError(e instanceof Error ? e.message : "Review failed."); }
    finally { setReviewing(""); }
  }

  const current = sections.find(item => item.id === active)!;
  const date = (value?: string) => value ? new Date(value).toLocaleString() : "—";
  const cell = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value);

  if (checking) return <main className="auth-screen"><div className="auth-card"><span className="brand-symbol">C</span><h1>Creative Clan</h1><p>Checking private access…</p></div></main>;
  if (!adminEmail) return (
    <main className="auth-screen"><form className="auth-card" onSubmit={login}>
      <span className="brand-symbol">C</span><p className="eyebrow">PRIVATE SUPER ADMIN</p><h1>Welcome back</h1>
      <p className="auth-copy">Sign in with your authorized administrator account.</p>
      <label>Email address<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
      {authError && <p className="auth-error">{authError}</p>}
      <button className="auth-submit" disabled={busy}>{busy ? "Verifying access…" : "Sign in securely"}</button>
      <small>No public signup or client login. Only owner-authorized accounts can enter.</small>
    </form></main>
  );

  return <main className="admin-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setActive("overview"); }}><span className="brand-symbol">C</span><span className="brand-name">Creative <b>Clan</b><small>PRIVATE ADMIN CONSOLE</small></span></a>
      <div className="nav-caption">CONTROL CENTER</div>
      <nav className="side-nav" aria-label="Admin navigation">
        {sections.map(item => <button key={item.id} className={active === item.id ? "nav-link active" : "nav-link"} onClick={() => setActive(item.id)}>
          <span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.id === "requests" && <span className="nav-count">{counts.pending_requests}</span>}
        </button>)}
      </nav>
      <div className="sidebar-bottom"><div className="secure-mark">◇</div><div><b>Private workspace</b><small>Owner access only</small></div><span className="secure-dot" /></div>
    </aside>
    <section className="main-area">
      <header className="topbar"><div className="breadcrumbs"><span>Creative Clan</span><i>/</i>{current.label}</div>
        <div className="topbar-right"><span className="environment"><i /> PRIVATE ADMIN</span><span className="admin-email">{adminEmail}</span><button className="logout-button" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
      </header>
      <div className="content">
        {active === "overview" ? <>
          <div className="page-heading"><div><p className="eyebrow">PRIVATE SUPER ADMIN</p><h1>Control center</h1><p className="subheading">Your AI business operations, access and systems in one place.</p></div><span className="date-label">LIVE SYSTEM OVERVIEW</span></div>
          <div className="notice"><span className="notice-icon">i</span><div><b>Private admin authentication is active</b><p>Live access request, business, connection and task counts are read from the secured backend.</p></div></div>
          <div className="section-title"><div><h2>System overview</h2><p>Current records from your private control plane.</p></div><button className="small-action" onClick={() => { void loadOverview(); void loadSection("overview"); }}>Refresh</button></div>
          <div className="stats-grid">
            <article className="stat-card"><span>Pending requests</span><strong>{counts.pending_requests}</strong><small>Awaiting your review</small><span className="stat-icon">⇥</span></article>
            <article className="stat-card"><span>Authorized businesses</span><strong>{counts.businesses}</strong><small>Active approvals</small><span className="stat-icon">▦</span></article>
            <article className="stat-card"><span>Active connections</span><strong>{counts.connections}</strong><small>Connected platforms</small><span className="stat-icon">↔</span></article>
            <article className="stat-card"><span>Agent tasks</span><strong>{counts.tasks}</strong><small>Recorded tasks</small><span className="stat-icon">☷</span></article>
          </div>
          {dataError && <p className="data-error">{dataError}</p>}
          <div className="overview-grid">
            <section className="panel"><div className="panel-heading"><div><h2>System modules</h2><p>Private control areas</p></div><span className="module-count">10 MODULES</span></div>
              <div className="module-list">{sections.slice(1).map(item => <button key={item.id} className="module-row" onClick={() => setActive(item.id)}><span className="module-icon">{item.icon}</span><span>{item.label}</span><span className="module-arrow">↗</span></button>)}</div>
            </section>
            <section className="panel architecture-panel"><p className="eyebrow">ARCHITECTURE RULE</p><h2>Your clients keep using their own platforms.</h2>
              <p>The agent reads and acts through approved integrations. Their store data stays in Shopify, WooCommerce or the original platform — it is not copied into a second inventory system.</p>
              <div className="architecture-flow"><span>Client platform</span><i>↔</i><span>AI agent</span><i>↔</i><span>Admin control</span></div>
              <div className="security-foot"><span>◇</span> Permission-based access · Admin approvals · Audit trail</div>
            </section>
          </div>
        </> : <>
          <div className="page-heading"><div><p className="eyebrow">{active in ["requests","businesses","connections","tasks","security"] ? "LIVE ADMIN DATA" : emptyStates[active].eyebrow}</p>
            <h1>{active === "requests" ? "Access requests" : active === "businesses" ? "Authorized businesses" : active === "connections" ? "Website connections" : active === "tasks" ? "Task center" : active === "security" ? "Audit & security" : emptyStates[active].title}</h1>
            <p className="subheading">{active === "requests" ? "Review incoming business requests and approve or decline platform access." : active === "businesses" ? "Internal records of businesses approved by you. No client portal or login is created." : active === "connections" ? "Officially authorized platform connections and their current status." : active === "tasks" ? "Agent execution history and task states." : active === "security" ? "Internal admin actions and audit trail." : emptyStates[active].description}</p>
          </div><span className="date-label">PRIVATE ADMIN AREA</span></div>
          {dataError && <p className="data-error">{dataError}</p>}
          {dataBusy ? <section className="empty-panel"><h2>Loading records…</h2></section> :
          ["requests","businesses","connections","tasks","security"].includes(active) ? (
            <section className="panel data-panel">
              <div className="panel-heading"><div><h2>{rows.length} record{rows.length === 1 ? "" : "s"}</h2><p>Latest 100 records</p></div><button className="small-action" onClick={() => void loadSection(active)}>Refresh</button></div>
              {rows.length === 0 ? <div className="empty-inline">No records yet.</div> :
                active === "requests" ? <div className="record-list">{rows.map(row => <article className="request-record" key={row.id}>
                  <div className="record-top"><div><h3>{cell(row.business_name)}</h3><p>{cell(row.owner_name)} · {cell(row.contact_email)}</p></div><span className={"status-pill " + row.status}>{row.status}</span></div>
                  <div className="record-details"><span><b>Platform:</b> {cell(row.platform)}</span><span><b>Website:</b> {cell(row.website_url)}</span><span><b>Phone:</b> {cell(row.contact_phone)}</span><span><b>Submitted:</b> {date(row.created_at)}</span></div>
                  {row.message && <p className="record-message">{row.message}</p>}
                  {(row.status === "pending" || row.status === "under_review") && <div className="review-controls"><input placeholder="Internal review note (optional)" value={reviewNotes[row.id] || ""} onChange={e => setReviewNotes(old => ({ ...old, [row.id]: e.target.value }))}/><button disabled={reviewing === row.id} onClick={() => void reviewRequest(row.id,"approve")}>{reviewing === row.id ? "Saving…" : "Approve"}</button><button className="danger-action" disabled={reviewing === row.id} onClick={() => void reviewRequest(row.id,"decline")}>Decline</button></div>}
                  {row.review_notes && <p className="record-message">Review note: {row.review_notes}</p>}
                </article>)}</div> :
                <div className="table-wrap"><table className="records-table"><thead><tr>{(active === "businesses" ? ["Business","Platform","Website","Status","Approved"] : active === "connections" ? ["Platform","External account","Status","Scopes","Connected"] : active === "tasks" ? ["Task type","Status","Approval required","Created"] : ["Action","Resource","Outcome","Created"]).map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.id}>{(active === "businesses" ? [row.business_name,row.platform,row.website_url,row.status,date(row.approved_at)] : active === "connections" ? [row.platform,row.external_account_ref,row.connection_status,(row.granted_scopes || []).join(", "),date(row.connected_at)] : active === "tasks" ? [row.task_type,row.status,row.requires_approval ? "Yes" : "No",date(row.created_at)] : [row.action,row.resource_type,row.outcome,date(row.created_at)]).map((v,i) => <td key={i}>{cell(v)}</td>)}</tr>)}</tbody></table></div>
              }
            </section>
          ) : <section className="empty-panel"><div className="empty-symbol">{current.icon}</div><h2>{emptyStates[active].note}</h2><p>This area is reserved for internal AI configuration and workflow controls. No fake records or client accounts are shown.</p></section>
          )}
          {active === "businesses" && <p className="privacy-note">Clients do not receive accounts on Creative Clan. All records are visible only to authorized internal administrators.</p>}
          {active === "connections" && <p className="privacy-note">Connection authorization must be granted by the business owner through the platform's official consent flow. Never ask clients to send store passwords.</p>}
        </>}
        <footer className="footer"><span>CREATIVE CLAN</span><span>PRIVATE AI BUSINESS AGENT · ADMIN CONTROL PLANE</span></footer>
      </div>
    </section>
  </main>;
}
