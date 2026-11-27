"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);
type Row = Record<string, any>;

function classify(label: string) {
  const value = label.toLowerCase();
  if (/logout|sign out|log out/.test(value)) return "authentication";
  if (/product|catalog|inventory|stock/.test(value)) return "products_or_inventory";
  if (/order|booking|appointment|request/.test(value)) return "orders_or_requests";
  if (/patient|customer|client|user|member/.test(value)) return "people_records";
  if (/setting|profile|security|notification/.test(value)) return "settings";
  if (/report|analytic|history|activity/.test(value)) return "reports_or_history";
  if (/dashboard|home|overview/.test(value)) return "dashboard";
  return "unclassified";
}

function makeMap(report: Row) {
  const headings = Array.isArray(report.headings) ? report.headings : [];
  const links = Array.isArray(report.links) ? report.links : [];
  const buttons = Array.isArray(report.buttons) ? report.buttons : [];
  const forms = Array.isArray(report.forms) ? report.forms : [];
  const sectionNames = [...new Set(headings.map((x: any) => String(x?.text || x || "").trim()).filter(Boolean))];
  const navLinks = links.map((x: any) => ({
    label: String(x?.text || "").trim().slice(0, 120),
    href: String(x?.href || "").slice(0, 2048),
    category: classify(String(x?.text || "")),
    verified: false
  })).filter((x: any) => x.label || x.href).slice(0, 80);
  const actions = buttons.map((x: any) => {
    const label = String(x?.text || x?.aria_label || x?.title || "Unlabelled button").trim().slice(0, 120);
    return { label, category: classify(label), element_type: String(x?.type || "button").slice(0, 30), verified: false, status: "function_not_yet_verified" };
  }).slice(0, 60);
  return {
    version: 1,
    generated_at: new Date().toISOString(),
    source: "authenticated_read_only_inspection",
    page_title: String(report.title || "").slice(0, 200),
    page_url: String(report.url || "").slice(0, 2048),
    sections: sectionNames.map((name: string) => ({ name, verified: false })),
    navigation: navLinks,
    buttons: actions,
    forms: forms.map((x: any, i: number) => ({
      index: i + 1,
      method: String(x?.method || "unknown").slice(0, 20),
      field_count: Number.isFinite(Number(x?.field_count)) ? Number(x.field_count) : null,
      verified: false,
      values_collected: false
    })).slice(0, 20),
    limitations: [
      "This map describes visible page structure only.",
      "Button functions and destination behavior have not been tested.",
      "No buttons were clicked, no forms were submitted, and no field values were collected."
    ],
    readiness: "structure_mapped_actions_unverified"
  };
}

export default function WebsiteUnderstanding() {
  const [reports, setReports] = useState<Row[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [map, setMap] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const callAdmin = useCallback(async (action: string, extra: Row = {}) => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) throw new Error("Admin session expired. Please sign in again.");
    const response = await fetch(process.env.NEXT_PUBLIC_API_BASE_URL + "/v1/admin/console", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.access_token },
      body: JSON.stringify({ action, ...extra })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.ok) throw new Error(data?.error || "Request failed.");
    return data;
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const result = await callAdmin("panel_scans");
      const items = (result.data || []) as Row[];
      setReports(items);
      setSelectedId((current) => current && items.some((x) => x.id === current) ? current : items[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load scan reports.");
    } finally {
      setLoading(false);
    }
  }, [callAdmin]);

  useEffect(() => { void loadReports(); }, [loadReports]);

  const selected = useMemo(() => reports.find((x) => x.id === selectedId) || null, [reports, selectedId]);
  const inspection = selected?.scan_report?.browser_inspection || null;
  const savedMap = selected?.scan_report?.website_map || null;

  function generateMap() {
    if (!inspection) {
      setMessage("This report has no authenticated browser inspection yet. Complete a secure browser inspection first.");
      return;
    }
    setMap(makeMap(inspection));
    setMessage("Draft map generated from the saved inspection. Button functions are not verified.");
  }

  async function saveMap() {
    if (!selectedId || !map) return;
    setBusy(true);
    setMessage("");
    try {
      await callAdmin("save_website_map", { scan_id: selectedId, website_map: map });
      setMessage("Website map saved to the selected scan report in Supabase.");
      await loadReports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save website map.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel data-panel" style={{ marginTop: 18 }}>
    <div className="panel-heading">
      <div>
        <span className="panel-kicker">WEBSITE UNDERSTANDING ENGINE · PHASE 1</span>
        <h2>Website Understanding</h2>
        <p>Turn a saved read-only inspection into a structured website map for future AI context.</p>
      </div>
      <button className="small-action" type="button" onClick={() => void loadReports()} disabled={loading}>Refresh reports</button>
    </div>
    <div className="credit-controls">
      <label>Choose an inspected website report
        <select value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setMap(null); setMessage(""); }}>
          <option value="">Select a saved scan</option>
          {reports.map((r) => <option key={r.id} value={r.id}>{r.scan_report?.browser_inspection?.title || r.normalized_url} · {new Date(r.created_at).toLocaleDateString()}</option>)}
        </select>
      </label>
      <button className="primary-action" type="button" onClick={generateMap} disabled={!inspection || loading}>Generate website map</button>
    </div>
    {loading && <p>Loading saved inspection reports…</p>}
    {!loading && selected && !inspection && <p className="privacy-note">This scan has no authenticated inspection yet. Open its report above and complete Secure Browser Inspection first.</p>}
    {selected && inspection && <div className="scan-metrics">
      <div><small>Sections</small><b>{inspection.headings?.length || 0}</b></div>
      <div><small>Navigation links</small><b>{inspection.links?.length || 0}</b></div>
      <div><small>Buttons</small><b>{inspection.buttons?.length || 0}</b></div>
      <div><small>Forms</small><b>{inspection.forms?.length || 0}</b></div>
    </div>}
    {savedMap && !map && <div className="scan-recommendations">
      <b>Previously saved website map</b>
      <p>{savedMap.sections?.length || 0} sections · {savedMap.navigation?.length || 0} links · {savedMap.buttons?.length || 0} buttons</p>
      <p>Map status: {savedMap.readiness || "saved"}</p>
      <button className="small-action" type="button" onClick={() => setMap(savedMap)}>View saved map</button>
    </div>}
    {map && <div className="scan-recommendations">
      <b>Generated website map</b>
      <p><strong>Page:</strong> {map.page_title || map.page_url}</p>
      <p><strong>Sections:</strong> {map.sections?.map((x: Row) => x.name).join(" · ") || "None detected"}</p>
      <p><strong>Navigation:</strong> {map.navigation?.length || 0} links · <strong>Buttons:</strong> {map.buttons?.length || 0} · <strong>Forms:</strong> {map.forms?.length || 0}</p>
      <p><strong>Important:</strong> Button functions remain unverified. This phase only classifies visible labels; it does not click or submit anything.</p>
      <button className="primary-action" type="button" onClick={() => void saveMap()} disabled={busy}>{busy ? "Saving map…" : "Save website map to Supabase"}</button>
    </div>}
    {message && <p role="status" className="privacy-note">{message}</p>}
  </section>;
}
