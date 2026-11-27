import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const cors = {
  "Access-Control-Allow-Origin": "https://ai-business-agent-admin.pages.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Invalid session" }, 401);

  const { data: adminRecord, error: adminError } = await admin
    .from("private_admins").select("role,is_active")
    .eq("auth_user_id", userData.user.id).maybeSingle();
  if (adminError || !adminRecord?.is_active || !["owner", "admin", "operator"].includes(adminRecord.role)) {
    return json({ error: "Admin access denied" }, 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const actor = userData.user.id;

    if (action === "save_branding") {
      const loginLogoUrl = typeof body.login_logo_url === "string" ? body.login_logo_url.slice(0, 2048) : null;
      const faviconUrl = typeof body.favicon_url === "string" ? body.favicon_url.slice(0, 2048) : null;
      for (const value of [loginLogoUrl, faviconUrl]) {
        if (value !== null) {
          let parsed: URL;
          try { parsed = new URL(value); } catch { return json({ error: "Branding asset URL is invalid." }, 400); }
          if (parsed.protocol !== "https:" || !parsed.hostname || !parsed.pathname.includes("/storage/v1/object/public/admin-branding/brand-assets/")) {
            return json({ error: "Branding assets must be uploaded to the approved public branding storage." }, 400);
          }
        }
      }
      const { data, error } = await admin.from("admin_branding").upsert({
        id: true, login_logo_url: loginLogoUrl, favicon_url: faviconUrl,
        updated_by: actor, updated_at: new Date().toISOString()
      }, { onConflict: "id" }).select("login_logo_url,favicon_url,updated_at").single();
      if (error) throw error;
      await admin.from("admin_audit_events").insert({
        actor_user_id: actor, action: "admin_branding_updated", resource_type: "admin_branding",
        resource_id: "true", outcome: "success",
        details: { login_logo_updated: Boolean(loginLogoUrl), favicon_updated: Boolean(faviconUrl) }
      });
      return json({ ok: true, data, message: "Branding settings saved." });
    }

    if (action === "overview") {
      const [requests, businesses, connections, tasks] = await Promise.all([
        admin.from("access_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        admin.from("authorized_businesses").select("id", { count: "exact", head: true }).eq("status", "active"),
        admin.from("platform_connections").select("id", { count: "exact", head: true }).eq("connection_status", "active"),
        admin.from("admin_agent_tasks").select("id", { count: "exact", head: true }),
      ]);
      const errors = [requests, businesses, connections, tasks].filter(x => x.error);
      if (errors.length) throw errors[0].error;
      return json({ ok: true, counts: { pending_requests: requests.count || 0, businesses: businesses.count || 0, connections: connections.count || 0, tasks: tasks.count || 0 } });
    }

    if (action === "requests") {
      const { data, error } = await admin.from("access_requests").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "review_request") {
      const id = String(body.id || "");
      const decision = body.decision;
      const notes = typeof body.notes === "string" ? body.notes.slice(0, 1000) : null;
      if (!id || !["approve", "decline"].includes(decision)) return json({ error: "Invalid review request" }, 400);
      const { data: request, error: readError } = await admin.from("access_requests").select("*").eq("id", id).single();
      if (readError) throw readError;
      if (request.status !== "pending" && request.status !== "under_review") return json({ error: "This request has already been reviewed" }, 409);

      if (decision === "approve") {
        const { error: businessError } = await admin.from("authorized_businesses").upsert({
          access_request_id: id,
          business_name: request.business_name,
          owner_name: request.owner_name,
          contact_email: request.contact_email,
          website_url: request.website_url,
          platform: request.platform,
          status: "active",
          approved_by: actor,
          approved_at: new Date().toISOString(),
          internal_notes: notes,
        }, { onConflict: "access_request_id" });
        if (businessError) throw businessError;
      }
      const nextStatus = decision === "approve" ? "approved" : "declined";
      const { error: updateError } = await admin.from("access_requests").update({
        status: nextStatus, reviewed_by: actor, reviewed_at: new Date().toISOString(), review_notes: notes,
      }).eq("id", id);
      if (updateError) throw updateError;
      await admin.from("admin_audit_events").insert({
        actor_user_id: actor, action: nextStatus, resource_type: "access_request", resource_id: id,
        outcome: "success", details: { business_name: request.business_name },
      });
      return json({ ok: true, status: nextStatus });
    }

    if (action === "businesses") {
      const { data, error } = await admin.from("authorized_businesses").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "connections") {
      const { data, error } = await admin.from("platform_connections").select("id,business_id,platform,external_account_ref,connection_status,granted_scopes,connected_at,last_verified_at,revoked_at,connection_metadata,created_at").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, data });
    }


    if (action === "start_connection_setup") {
      const businessId = String(body.business_id || "");
      const platform = String(body.platform || "").toLowerCase();
      const domainInput = String(body.domain || "").trim();
      const method = String(body.method || "");
      const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";
      const allowed = {
        shopify: ["oauth"],
        woocommerce: ["rest_api"],
        hostinger: ["wordpress_plugin", "custom_api"],
        custom: ["custom_api"]
      } as Record<string, string[]>;
      if (!businessId || !Object.prototype.hasOwnProperty.call(allowed, platform) || !allowed[platform].includes(method)) {
        return json({ error: "Choose a supported platform and its matching connection method." }, 400);
      }
      let parsed: URL;
      try { parsed = new URL(domainInput.includes("://") ? domainInput : "https://" + domainInput); }
      catch { return json({ error: "Enter a valid website domain." }, 400); }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname || parsed.hostname.includes("..")) {
        return json({ error: "Use a valid HTTPS website domain without credentials." }, 400);
      }
      const domain = parsed.hostname.toLowerCase();
      if (platform === "shopify" && !domain.endsWith(".myshopify.com")) {
        return json({ error: "For Shopify, enter the store's myshopify.com domain." }, 400);
      }
      const { data: business, error: businessError } = await admin.from("authorized_businesses")
        .select("id,business_name,status").eq("id", businessId).single();
      if (businessError || !business || business.status !== "active") {
        return json({ error: "Select an approved, active business first." }, 400);
      }
      const now = new Date().toISOString();
      const { data, error } = await admin.from("platform_connections").upsert({
        business_id: businessId,
        platform,
        external_account_ref: domain,
        connection_status: "pending",
        granted_scopes: [],
        connected_at: null,
        last_verified_at: null,
        revoked_at: null,
        connection_metadata: {
          setup_method: method,
          setup_status: "awaiting_platform_authorization",
          setup_notes: notes,
          requested_by: actor,
          requested_at: now,
          credentials_stored: false,
          authorization_complete: false
        },
        updated_at: now
      }, { onConflict: "business_id,platform,external_account_ref" })
        .select("id,business_id,platform,external_account_ref,connection_status,granted_scopes,connection_metadata,created_at").single();
      if (error) throw error;
      const { error: auditError } = await admin.from("admin_audit_events").insert({
        actor_user_id: actor, business_id: businessId, action: "platform_connection_setup_started",
        resource_type: "platform_connection", resource_id: data.id, outcome: "success",
        details: { platform, domain, method, business_name: business.business_name }
      });
      if (auditError) throw auditError;
      return json({ ok: true, data, message: "Setup request saved. The platform authorization flow is not complete yet." });
    }

    if (action === "cancel_connection_setup") {
      const id = String(body.id || "");
      if (!id) return json({ error: "Connection record is required." }, 400);
      const { data, error } = await admin.from("platform_connections")
        .update({ connection_status: "revoked", revoked_at: new Date().toISOString(),
          connection_metadata: { setup_status: "cancelled", cancelled_by: actor, credentials_stored: false } })
        .eq("id", id).neq("connection_status", "active")
        .select("id,business_id,platform,connection_status").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Only pending or inactive setup records can be cancelled here." }, 409);
      await admin.from("admin_audit_events").insert({
        actor_user_id: actor, business_id: data.business_id, action: "platform_connection_setup_cancelled",
        resource_type: "platform_connection", resource_id: id, outcome: "success",
        details: { platform: data.platform }
      });
      return json({ ok: true, data });
    }

    if (action === "create_task") {
      const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
      if (!instruction || instruction.length > 4000) return json({ error: "Enter a task instruction (1–4000 characters)." }, 400);
      const ai = body.ai_result && typeof body.ai_result === "object" ? body.ai_result : null;
      const now = new Date().toISOString();
      const { data: task, error: taskError } = await admin.from("admin_agent_tasks").insert({
        task_type: ai ? "assistant_command" : "admin_instruction",
        status: ai ? "completed" : "queued",
        input: { instruction, submitted_via: "private_admin_console" },
        output: ai ? { response: String(ai.response || ""), model: String(ai.model || ""), usage: {
          input_tokens: Number(ai.input_tokens || 0), output_tokens: Number(ai.output_tokens || 0),
          neurons_estimate: Number(ai.neurons_estimate || 0), usage_available: Boolean(ai.usage_available)
        } } : null,
        started_at: ai ? now : null,
        completed_at: ai ? now : null,
        requires_approval: false
      }).select("*").single();
      if (taskError) throw taskError;
      if (ai) {
        const { error: usageError } = await admin.from("usage_records").insert({
          task_id: task.id, provider: "cloudflare_workers_ai", model: String(ai.model || "@cf/zai-org/glm-4.7-flash"),
          input_units: Number(ai.input_tokens || 0), output_units: Number(ai.output_tokens || 0),
          estimated_cost: 0, currency: "USD",
          metadata: { neurons_estimate: Number(ai.neurons_estimate || 0), free_tier: true, usage_available: Boolean(ai.usage_available) }
        });
        if (usageError) throw usageError;
      }
      const { error: auditError } = await admin.from("admin_audit_events").insert({
        actor_user_id: actor, action: ai ? "ai_command_analyzed" : "task_queued", resource_type: "admin_agent_task",
        resource_id: task.id, outcome: "success",
        details: { task_type: task.task_type, status: task.status }
      });
      if (auditError) throw auditError;
      return json({ ok: true, data: task, message: ai ? "AI response generated and saved." : "Task safely queued. Execution is not enabled yet." });
    }

    if (action === "tasks") {
      const { data, error } = await admin.from("admin_agent_tasks").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "automations") {
      const { data, error } = await admin.from("automation_definitions")
        .select("id,business_id,name,description,trigger_type,trigger_config,is_enabled,requires_approval,created_at,updated_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "credits") {
      const [businesses, accounts] = await Promise.all([
        admin.from("authorized_businesses").select("id,business_name,owner_name,contact_email,platform,status").order("created_at", { ascending: false }).limit(200),
        admin.from("ai_credit_accounts").select("business_id,monthly_quota,available_credits,used_this_period,low_balance_threshold,period_started_at,period_ends_at,is_blocked,block_reason,updated_at")
      ]);
      if (businesses.error) throw businesses.error;
      if (accounts.error) throw accounts.error;
      const byBusiness = new Map((accounts.data || []).map((account: any) => [account.business_id, account]));
      const data = (businesses.data || []).map((business: any) => ({
        business_id: business.id, business,
        monthly_quota: 0, available_credits: 0, used_this_period: 0,
        low_balance_threshold: 0, is_blocked: false, block_reason: null,
        ...(byBusiness.get(business.id) || {})
      }));
      return json({ ok: true, data });
    }

    if (action === "credit_history") {
      const businessId = String(body.business_id || "");
      if (!businessId) return json({ error: "Business is required." }, 400);
      const { data, error } = await admin.from("ai_credit_ledger")
        .select("id,entry_type,amount,balance_after,reason,actor_user_id,created_at")
        .eq("business_id", businessId).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "set_credit_quota") {
      const businessId = String(body.business_id || "");
      const quota = Number(body.monthly_quota);
      const threshold = Number(body.low_balance_threshold ?? Math.floor(quota * 0.2));
      if (!businessId || !Number.isSafeInteger(quota) || quota < 0 || quota > 1000000000 ||
          !Number.isSafeInteger(threshold) || threshold < 0 || threshold > quota) {
        return json({ error: "Enter a valid quota and low-balance threshold." }, 400);
      }
      const { data, error } = await admin.from("ai_credit_accounts").upsert({
        business_id: businessId, monthly_quota: quota, low_balance_threshold: threshold,
        updated_at: new Date().toISOString()
      }, { onConflict: "business_id" }).select("*").single();
      if (error) throw error;
      const { error: auditError } = await admin.from("admin_audit_events").insert({
        actor_user_id: actor, business_id: businessId, action: "ai_credit_quota_set",
        resource_type: "ai_credit_account", resource_id: businessId, outcome: "success",
        details: { monthly_quota: quota, low_balance_threshold: threshold }
      });
      if (auditError) throw auditError;
      return json({ ok: true, data });
    }

    if (action === "top_up_credits") {
      const businessId = String(body.business_id || "");
      const amount = Number(body.amount);
      const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
      if (!businessId || !Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000 || reason.length < 3) {
        return json({ error: "Enter a valid business, positive credit amount and reason." }, 400);
      }
      const idempotencyKey = typeof body.idempotency_key === "string" && body.idempotency_key.length >= 8
        ? body.idempotency_key : crypto.randomUUID();
      const { data: result, error } = await admin.rpc("admin_add_ai_credits", {
        p_business_id: businessId, p_amount: amount, p_entry_type: "top_up",
        p_reason: reason, p_actor_user_id: actor, p_idempotency_key: idempotencyKey
      });
      if (error) throw error;
      const { error: auditError } = await admin.from("admin_audit_events").insert({
        actor_user_id: actor, business_id: businessId, action: "ai_credits_topped_up",
        resource_type: "ai_credit_ledger", outcome: "success",
        details: { amount, reason, balance_after: result.balance, ledger_id: result.ledger_id, duplicate: result.duplicate }
      });
      if (auditError) throw auditError;
      return json({ ok: true, data: result });
    }

    if (action === "usage") {
      const { data, error } = await admin.from("usage_records")
        .select("id,business_id,task_id,provider,model,input_units,output_units,estimated_cost,currency,metadata,recorded_at")
        .order("recorded_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "audit") {
      const { data, error } = await admin.from("admin_audit_events").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "panel_scans") {
      const { data, error } = await admin.from("admin_panel_scans")
        .select("id,submitted_url,normalized_url,scan_status,http_status,detected_stack,recommended_method,confidence,findings,recommendations,scan_report,scanned_at,created_at")
        .eq("created_by", actor).order("created_at", { ascending: false }).limit(25);
      if (error) throw error;
      return json({ ok: true, data });
    }

    if (action === "save_panel_scan") {
      const scan = body.scan && typeof body.scan === "object" ? body.scan : {};
      const submittedUrl = typeof scan.submitted_url === "string" ? scan.submitted_url.trim().slice(0, 2048) : "";
      const normalizedUrl = typeof scan.normalized_url === "string" ? scan.normalized_url.trim().slice(0, 2048) : "";
      const scanStatus = ["completed", "blocked", "failed"].includes(scan.scan_status) ? scan.scan_status : "failed";
      const recommendedMethod = ["api", "secure_browser", "additional_access", "manual_review"].includes(scan.recommended_method) ? scan.recommended_method : "manual_review";
      const confidence = ["low", "medium", "high"].includes(scan.confidence) ? scan.confidence : "low";
      const httpStatus = Number.isInteger(scan.http_status) && scan.http_status >= 100 && scan.http_status <= 599 ? scan.http_status : null;
      const detectedStack = typeof scan.detected_stack === "string" ? scan.detected_stack.slice(0, 160) : null;
      const findings = Array.isArray(scan.findings) ? scan.findings.slice(0, 20) : [];
      const recommendations = Array.isArray(scan.recommendations) ? scan.recommendations.slice(0, 20) : [];
      const report = scan.scan_report && typeof scan.scan_report === "object" ? scan.scan_report : {};
      if (!submittedUrl || !normalizedUrl) return json({ error: "A valid scan URL is required." }, 400);
      const { data, error } = await admin.from("admin_panel_scans").insert({
        created_by: actor, submitted_url: submittedUrl, normalized_url: normalizedUrl,
        scan_status: scanStatus, http_status: httpStatus, detected_stack: detectedStack,
        recommended_method: recommendedMethod, confidence, findings, recommendations,
        scan_report: report, scanned_at: new Date().toISOString()
      }).select("id,submitted_url,normalized_url,scan_status,http_status,detected_stack,recommended_method,confidence,findings,recommendations,scan_report,scanned_at,created_at").single();
      if (error) throw error;
      const { error: auditError } = await admin.from("admin_audit_events").insert({
        actor_user_id: actor, action: "admin_panel_compatibility_scanned",
        resource_type: "admin_panel_scan", resource_id: data.id, outcome: "success",
        details: { hostname: new URL(normalizedUrl).hostname, recommended_method: recommendedMethod, confidence, scan_status: scanStatus }
      });
      if (auditError) throw auditError;
      return json({ ok: true, data, message: "Passive compatibility scan saved. No login or business data was accessed." });
    }

    if (action === "save_browser_inspection") {
      const scanId = String(body.scan_id || "");
      const report = body.report && typeof body.report === "object" ? body.report : null;
      if (!/^[0-9a-fA-F-]{36}$/.test(scanId) || !report) return json({ error: "A valid scan and inspection report are required." }, 400);
      const { data: existing, error: readError } = await admin.from("admin_panel_scans")
        .select("id,created_by,scan_report").eq("id", scanId).eq("created_by", actor).single();
      if (readError || !existing) return json({ error: "Scan report not found for this admin account." }, 404);
      const safeReport = {
        inspected_at: new Date().toISOString(),
        url: typeof report.url === "string" ? report.url.slice(0, 2048) : null,
        title: typeof report.title === "string" ? report.title.slice(0, 200) : null,
        headings: Array.isArray(report.headings) ? report.headings.slice(0, 30) : [],
        links: Array.isArray(report.links) ? report.links.slice(0, 80).map((item: any) => ({
          text: typeof item.text === "string" ? item.text.slice(0, 120) : "",
          href: typeof item.href === "string" ? item.href.slice(0, 2048) : ""
        })) : [],
        forms: Array.isArray(report.forms) ? report.forms.slice(0, 20) : [],
        buttons: Array.isArray(report.buttons) ? report.buttons.slice(0, 60) : [],
        mode: "authenticated_read_only_metadata",
        no_form_submissions: true,
        no_button_clicks: true,
        no_field_values_collected: true
      };
      const prior = existing.scan_report && typeof existing.scan_report === "object" ? existing.scan_report : {};
      const merged = { ...prior, browser_inspection: safeReport };
      const { data, error } = await admin.from("admin_panel_scans").update({
        scan_report: merged, scan_status: "completed"
      }).eq("id", scanId).eq("created_by", actor)
        .select("id,submitted_url,normalized_url,scan_status,http_status,detected_stack,recommended_method,confidence,findings,recommendations,scan_report,scanned_at,created_at").single();
      if (error) throw error;
      const { error: auditError } = await admin.from("admin_audit_events").insert({
        actor_user_id: actor, action: "admin_panel_authenticated_read_only_inspection",
        resource_type: "admin_panel_scan", resource_id: scanId, outcome: "success",
        details: { inspected_url: safeReport.url, headings_count: safeReport.headings.length, links_count: safeReport.links.length, forms_count: safeReport.forms.length, buttons_count: safeReport.buttons.length }
      });
      if (auditError) throw auditError;
      return json({ ok: true, data, message: "Authenticated read-only inspection saved. No forms submitted and no buttons clicked." });
    }

    if (action === "invoices") {
      const [invoiceResult, businessResult] = await Promise.all([
        admin.from("admin_invoices").select("*").order("created_at", { ascending: false }).limit(100),
        admin.from("authorized_businesses").select("id,business_name,owner_name,contact_email").eq("status", "active").order("business_name")
      ]);
      if (invoiceResult.error) throw invoiceResult.error;
      if (businessResult.error) throw businessResult.error;
      const businessById = new Map((businessResult.data || []).map((b: any) => [b.id, b]));
      const data = (invoiceResult.data || []).map((invoice: any) => ({
        ...invoice, business_name: businessById.get(invoice.business_id)?.business_name || "—"
      }));
      return json({ ok: true, data, businesses: businessResult.data || [] });
    }

    if (action === "create_invoice") {
      const description = typeof body.description === "string" ? body.description.trim().slice(0, 300) : "";
      const amount = Number(body.amount);
      const businessId = typeof body.business_id === "string" && body.business_id ? body.business_id : null;
      const dueDate = typeof body.due_date === "string" && body.due_date ? body.due_date : null;
      if (!description || !Number.isFinite(amount) || amount <= 0 || amount > 1000000000) {
        return json({ error: "Enter an invoice description and a valid amount." }, 400);
      }
      if (businessId) {
        const { data: business, error: businessError } = await admin.from("authorized_businesses")
          .select("id").eq("id", businessId).eq("status", "active").maybeSingle();
        if (businessError) throw businessError;
        if (!business) return json({ error: "Select a valid active business." }, 400);
      }
      const { data: invoiceNumber, error: numberError } = await admin.rpc("next_admin_invoice_number");
      if (numberError) throw numberError;
      const { data, error } = await admin.from("admin_invoices").insert({
        invoice_number: invoiceNumber, business_id: businessId, description, amount,
        currency: "PKR", due_date: dueDate, status: "draft", created_by: actor
      }).select("*").single();
      if (error) throw error;
      await admin.from("admin_audit_events").insert({
        actor_user_id: actor, action: "invoice_created", resource_type: "admin_invoice",
        resource_id: data.id, outcome: "success",
        details: { invoice_number: data.invoice_number, amount, business_id: businessId }
      });
      return json({ ok: true, data, message: "Invoice created." });
    }

    if (action === "update_invoice") {
      const id = String(body.id || "");
      const status = String(body.status || "");
      if (!id || !["draft", "issued", "paid", "overdue", "void"].includes(status)) {
        return json({ error: "Choose a valid invoice status." }, 400);
      }
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { status, updated_at: now };
      if (status === "issued") updates.issued_at = now;
      if (status === "paid") updates.paid_at = now;
      const { data, error } = await admin.from("admin_invoices").update(updates)
        .eq("id", id).select("*").single();
      if (error) throw error;
      await admin.from("admin_audit_events").insert({
        actor_user_id: actor, action: "invoice_status_updated", resource_type: "admin_invoice",
        resource_id: id, outcome: "success", details: { status, invoice_number: data.invoice_number }
      });
      return json({ ok: true, data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (error) {
    console.error("admin-console error", error);
    return json({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});