const metrics = [
  { label: "Total sales", value: "—", note: "Connect your workspace", icon: "↗" },
  { label: "Orders", value: "—", note: "Your orders will appear here", icon: "▤" },
  { label: "Products", value: "—", note: "Inventory overview", icon: "□" },
  { label: "Expenses", value: "—", note: "Track business spending", icon: "−" }
];

const actions = [
  { title: "Add your first product", detail: "Build your product catalogue", number: "01" },
  { title: "Record a sale", detail: "Keep sales and stock in sync", number: "02" },
  { title: "Ask your AI manager", detail: "Get answers from your business data", number: "03" }
];

export default function Home() {
  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><span>agent<span className="brand-light">/</span>biz</span></div>
        <div className="workspace-label">WORKSPACE</div>
        <button className="workspace-switch"><span className="workspace-avatar">B</span><span><b>My Business</b><small>Free workspace</small></span><span className="chevron">⌄</span></button>
        <nav>
          <a className="nav-item active" href="#"><span>▦</span> Overview</a>
          <a className="nav-item" href="#"><span>□</span> Products & inventory</a>
          <a className="nav-item" href="#"><span>▤</span> Orders & sales</a>
          <a className="nav-item" href="#"><span>↘</span> Expenses</a>
          <a className="nav-item" href="#"><span>✧</span> AI business manager</a>
          <div className="nav-divider" />
          <a className="nav-item" href="#"><span>⚙</span> Settings</a>
        </nav>
        <div className="sidebar-bottom"><div className="status-dot" /> Systems setup in progress <small>v0.1.0</small></div>
      </aside>

      <section className="main-area">
        <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> Overview</div><div className="top-actions"><span className="live-pill"><i /> Setup mode</span><div className="user-avatar">S</div></div></header>
        <div className="content">
          <div className="welcome-row"><div><p className="eyebrow">YOUR BUSINESS, IN CONTROL</p><h1>Good to see you.</h1><p className="subheading">Here’s what’s happening with your business today.</p></div><button className="primary-button" disabled>＋ Add new <span>⌄</span></button></div>

          <div className="setup-banner"><div className="banner-icon">✧</div><div><b>Your business workspace is being prepared</b><p>Connect your account and add your first products to bring this dashboard to life.</p></div><span className="banner-tag">INITIAL SETUP</span></div>

          <div className="section-heading"><div><h2>Business overview</h2><p>Live performance will show here once connected.</p></div><span className="period-label">ALL TIME　⌄</span></div>
          <div className="metric-grid">{metrics.map((m) => <article className="metric-card" key={m.label}><div className="metric-top"><span>{m.label}</span><span className="metric-icon">{m.icon}</span></div><strong>{m.value}</strong><small>{m.note}</small></article>)}</div>

          <div className="lower-grid"><section className="panel"><div className="panel-heading"><div><h2>Get started</h2><p>Your first three steps</p></div><span className="progress-count">0 / 3</span></div><div className="progress-track"><span /></div>{actions.map((a) => <div className="action-row" key={a.number}><span className="action-number">{a.number}</span><div><b>{a.title}</b><small>{a.detail}</small></div><span className="action-arrow">↗</span></div>)}</section>
          <section className="ai-panel"><div className="ai-orb">✧</div><p className="eyebrow">MEET YOUR AI MANAGER</p><h2>Your business brain.<br/>One conversation away.</h2><p>Ask about stock, sales, expenses and what needs your attention. Your AI manager will use your business data to help you make smarter decisions.</p><div className="sample-prompt">“Which products are running low?” <span>↗</span></div><div className="coming-soon">AI CONNECTION — COMING NEXT</div></section></div>
          <footer>AI BUSINESS AGENT <span>Built to make business simpler.</span></footer>
        </div>
      </section>
    </main>
  );
}