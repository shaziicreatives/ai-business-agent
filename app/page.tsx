"use client";

import { useEffect, useState } from "react";
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

const emptyStates: Record<Exclude<SectionId, "overview">, { eyebrow: string; title: string; description: string; note: string }> = {
  requests: {
    eyebrow: "ONBOARDING",
    title: "Access requests",
    description: "Business owners will submit their details through a separate request form. Requests will appear here for your review.",
    note: "The public request form and secure submission endpoint are not connected yet.",
  },
  businesses: {
    eyebrow: "INTERNAL RECORDS",
    title: "Authorized businesses",
    description: "This is an internal record of businesses you have approved. It does not create a client login, portal or dashboard.",
    note: "No businesses have been authorized yet.",
  },
  connections: {
    eyebrow: "INTEGRATIONS",
    title: "Website connections",
    description: "Connect approved businesses through official OAuth or another supported delegated authorization flow.",
    note: "No external platforms are connected yet. Client passwords must not be collected in ordinary forms.",
  },
  ai: {
    eyebrow: "AGENT CONFIGURATION",
    title: "AI control center",
    description: "Configure the model provider, agent instructions, available tools, permission boundaries and approval rules.",
    note: "No AI model or provider is connected yet.",
  },
  automations: {
    eyebrow: "WORKFLOWS",
    title: "Automations",
    description: "Manage event-driven workflows that run only against businesses with valid, authorized connections.",
    note: "No automations have been configured yet.",
  },
  tasks: {
    eyebrow: "EXECUTION",
    title: "Task center",
    description: "Review queued, running, completed and failed agent tasks. Sensitive actions can be held for your approval.",
    note: "No agent tasks have been created yet.",
  },
  usage: {
    eyebrow: "OBSERVABILITY",
    title: "Usage & costs",
    description: "Track model usage, platform usage, execution volume and infrastructure costs before they become surprises.",
    note: "Usage reporting will appear after the integrations are connected.",
  },
  security: {
    eyebrow: "CONTROL & TRACEABILITY",
    title: "Audit & security",
    description: "Review authorization events, admin actions, agent decisions, approvals and connection revocations.",
    note: "No audit events have been recorded yet.",
  },
  settings: {
    eyebrow: "SYSTEM",
    title: "Settings",
    description: "Manage private admin access, system preferences, integration defaults and operational safeguards.",
    note: "Admin authentication and role configuration are still required before production use.",
  },
};

export default function Home() {
  const [active, setActive] = useState<SectionId>("overview");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);

  async function checkAdmin(token: string) {
    const { data, error } = await supabase.functions.invoke("admin-verify", {
      headers: { Authorization: "Bearer " + token },
      body: {},
    });
    if (error || !data?.authorized) {
      await supabase.auth.signOut();
      throw new Error("This account is not authorized for the private admin panel.");
    }
    setAdminEmail(data.email || "");
  }

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        try { await checkAdmin(data.session.access_token); }
        catch (e) { if (active) setAuthError(e instanceof Error ? e.message : "Access check failed."); }
      }
      if (active) setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) { if (active) setAdminEmail(""); return; }
      try { await checkAdmin(session.access_token); }
      catch (e) { if (active) setAuthError(e instanceof Error ? e.message : "Access check failed."); }
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setAuthError("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw new Error(error?.message || "Sign in failed.");
      await checkAdmin(data.session.access_token);
    } catch (e) { setAuthError(e instanceof Error ? e.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }
  const current = sections.find((item) => item.id === active)!;

  if (checking) return <main className="auth-screen"><div className="auth-card"><span className="brand-symbol">C</span><h1>Creative Clan</h1><p>Checking private access…</p></div></main>;

  if (!adminEmail) return (
    <main className="auth-screen">
      <form className="auth-card" onSubmit={login}>
        <span className="brand-symbol">C</span>
        <p className="eyebrow">PRIVATE SUPER ADMIN</p>
        <h1>Welcome back</h1>
        <p className="auth-copy">Sign in with your authorized administrator account.</p>
        <label>Email address<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {authError && <p className="auth-error">{authError}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? "Verifying access…" : "Sign in securely"}</button>
        <small>No public signup or client login. Only owner-authorized accounts can enter.</small>
      </form>
    </main>
  );

  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setActive("overview"); }}>
          <span className="brand-symbol">C</span>
          <span className="brand-name">Creative <b>Clan</b><small>PRIVATE ADMIN CONSOLE</small></span>
        </a>

        <div className="nav-caption">CONTROL CENTER</div>
        <nav className="side-nav" aria-label="Admin navigation">
          {sections.map((item) => (
            <button key={item.id} className={active === item.id ? "nav-link active" : "nav-link"} onClick={() => setActive(item.id)}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.id === "requests" && <span className="nav-count">0</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="secure-mark">◇</div>
          <div><b>Private workspace</b><small>Owner access only</small></div>
          <span className="secure-dot" />
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Creative Clan</span><i>/</i>{current.label}</div>
          <div className="topbar-right"><span className="environment"><i /> PRIVATE ADMIN</span><span className="admin-email">{adminEmail}</span><button className="logout-button" onClick={() => supabase.auth.signOut()}>Sign out</button></div>
        </header>

        <div className="content">
          {active === "overview" ? (
            <>
              <div className="page-heading">
                <div><p className="eyebrow">PRIVATE SUPER ADMIN</p><h1>Control center</h1><p className="subheading">Your AI business operations, access and systems in one place.</p></div>
                <span className="date-label">SYSTEM OVERVIEW</span>
              </div>

              <div className="notice">
                <span className="notice-icon">i</span>
                <div><b>Foundation is being configured</b><p>This console is a frontend foundation. Live authentication, access requests, platform connections and AI execution are not enabled yet.</p></div>
              </div>

              <div className="section-title"><div><h2>System overview</h2><p>Live counts will populate when backend services are connected.</p></div><span className="read-only">NO DEMO DATA</span></div>
              <div className="stats-grid">
                <article className="stat-card"><span>Pending requests</span><strong>0</strong><small>Awaiting your review</small><span className="stat-icon">⇥</span></article>
                <article className="stat-card"><span>Authorized businesses</span><strong>0</strong><small>Approved access records</small><span className="stat-icon">▦</span></article>
                <article className="stat-card"><span>Active connections</span><strong>0</strong><small>Revocable platform access</small><span className="stat-icon">↔</span></article>
                <article className="stat-card"><span>Agent tasks</span><strong>0</strong><small>Tasks currently recorded</small><span className="stat-icon">☷</span></article>
              </div>

              <div className="overview-grid">
                <section className="panel">
                  <div className="panel-heading"><div><h2>System modules</h2><p>Planned control areas</p></div><span className="module-count">10 MODULES</span></div>
                  <div className="module-list">
                    {sections.slice(1).map((item) => <button key={item.id} className="module-row" onClick={() => setActive(item.id)}><span className="module-icon">{item.icon}</span><span>{item.label}</span><span className="module-arrow">↗</span></button>)}
                  </div>
                </section>
                <section className="panel architecture-panel">
                  <p className="eyebrow">ARCHITECTURE RULE</p>
                  <h2>Your clients keep using their own platforms.</h2>
                  <p>The agent reads and acts through approved integrations. Their store data stays in Shopify, WooCommerce or the original platform — it is not copied into a second inventory system.</p>
                  <div className="architecture-flow"><span>Client platform</span><i>↔</i><span>AI agent</span><i>↔</i><span>Admin control</span></div>
                  <div className="security-foot"><span>◇</span> Permission-based access · Admin approvals · Audit trail</div>
                </section>
              </div>

              <section className="panel next-panel">
                <div><p className="eyebrow">NEXT FOUNDATION MILESTONES</p><h2>Build in the right order</h2><p>Secure the admin identity and request pipeline before enabling real business access.</p></div>
                <ol><li><span>01</span> Admin authentication & access control</li><li><span>02</span> Secure public access-request endpoint</li><li><span>03</span> OAuth connection lifecycle</li><li><span>04</span> Agent task permissions & approvals</li></ol>
              </section>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div><p className="eyebrow">{emptyStates[active].eyebrow}</p><h1>{emptyStates[active].title}</h1><p className="subheading">{emptyStates[active].description}</p></div>
                <span className="date-label">PRIVATE ADMIN AREA</span>
              </div>
              <section className="empty-panel">
                <div className="empty-symbol">{current.icon}</div>
                <h2>{emptyStates[active].note}</h2>
                <p>This section is prepared in the admin interface. Its live data and actions will be enabled after the secure backend workflow is implemented and tested.</p>
              </section>
              {active === "businesses" && <p className="privacy-note">Businesses do not receive accounts on Creative Clan. These records are visible only to authorized internal administrators.</p>}
              {active === "connections" && <p className="privacy-note">Authorization must be granted by the business owner through the platform's official consent flow. Never ask clients to send store passwords.</p>}
            </>
          )}
          <footer className="footer"><span>CREATIVE CLAN</span><span>PRIVATE AI BUSINESS AGENT · FOUNDATION BUILD</span></footer>
        </div>
      </section>
    </main>
  );
}
