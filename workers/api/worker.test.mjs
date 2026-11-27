import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

const env = {
  SUPABASE_URL: "https://project.example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only",
  AI: { run: async () => ({ response: "Test answer", usage: { prompt_tokens: 100, completion_tokens: 30 } }) }
};
const ADMIN_ORIGIN = "https://ai-business-agent-admin.pages.dev";

test("health endpoint reports foundation capabilities and security headers", async () => {
  const response = await worker.fetch(new Request("https://api.example/health"), env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.service, "ai-business-agent-api");
  assert.equal(data.version, "0.5.0");
  assert.equal(data.status, "gateway_foundation");
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.ok(response.headers.get("x-request-id"));
});

test("preflight returns an empty 204 response for the admin origin", async () => {
  const response = await worker.fetch(new Request("https://api.example/v1/admin/console", {
    method: "OPTIONS",
    headers: { Origin: ADMIN_ORIGIN }
  }), env);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("access-control-allow-origin"), ADMIN_ORIGIN);
});

test("rejects an unapproved browser origin", async () => {
  const response = await worker.fetch(new Request("https://api.example/health", {
    headers: { Origin: "https://attacker.example" }
  }), env);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("access-control-allow-origin"), null);
});

test("admin endpoints require a bearer token before upstream access", async () => {
  const response = await worker.fetch(new Request("https://api.example/v1/admin/verify", {
    method: "POST",
    headers: { Origin: ADMIN_ORIGIN, "Content-Type": "application/json" },
    body: "{}"
  }), env);
  assert.equal(response.status, 401);
});

test("admin proxy forwards the user JWT and publishable key to the verify function", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ authorized: true, email: "owner@example.test" }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/v1/admin/verify", {
      method: "POST",
      headers: {
        Origin: ADMIN_ORIGIN,
        Authorization: "Bearer test-user-jwt",
        "Content-Type": "application/json"
      },
      body: "{}"
    }), env);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.authorized, true);
    assert.equal(captured.url, "https://project.example.supabase.co/functions/v1/admin-verify");
    assert.equal(captured.init.headers.authorization, "Bearer test-user-jwt");
    assert.equal(captured.init.headers.apikey, "sb_publishable_test_only");
    assert.equal(response.headers.get("access-control-allow-origin"), ADMIN_ORIGIN);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public access-request proxy never forwards a browser Authorization header", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/v1/access-requests", {
      method: "POST",
      headers: {
        Origin: ADMIN_ORIGIN,
        Authorization: "Bearer should-not-forward",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ business_name: "Example" })
    }), env);
    assert.equal(response.status, 200);
    assert.equal(captured.url, "https://project.example.supabase.co/functions/v1/submit-access-request");
    assert.equal(captured.init.headers.authorization, undefined);
    assert.equal(captured.init.headers.apikey, "sb_publishable_test_only");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("rejects oversized request bodies before upstream access", async () => {
  const response = await worker.fetch(new Request("https://api.example/v1/access-requests", {
    method: "POST",
    headers: { Origin: ADMIN_ORIGIN, "Content-Type": "application/json" },
    body: "x".repeat(32 * 1024 + 1)
  }), env);
  assert.equal(response.status, 413);
});

test("reports missing Worker bindings instead of calling Supabase", async () => {
  const response = await worker.fetch(new Request("https://api.example/v1/access-requests", {
    method: "POST",
    body: "{}"
  }), {});
  assert.equal(response.status, 503);
});

test("AI command authenticates the admin, generates a response and stores the result", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/admin-verify")) return new Response(JSON.stringify({ authorized: true }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, data: { id: "task-123" } }), { status: 200 });
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/v1/agent/command", {
      method: "POST",
      headers: { Origin: ADMIN_ORIGIN, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ instruction: "Summarize my business performance" })
    }), env);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.data.response, "Test answer");
    assert.equal(data.data.usage.input_tokens, 100);
    assert.equal(data.data.usage.output_tokens, 30);
    assert.equal(data.data.usage.neurons_estimate, 1.642);
    assert.equal(calls.length, 2);
    const saved = JSON.parse(calls[1].init.body);
    assert.equal(saved.action, "create_task");
    assert.equal(saved.ai_result.model, "@cf/zai-org/glm-4.7-flash");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AI command loads approved client website context before answering", async () => {
  const originalFetch = globalThis.fetch;
  const originalRun = env.AI.run;
  const calls = [];
  let modelMessages;
  env.AI.run = async (_model, input) => {
    modelMessages = input.messages;
    return { response: "Your client dashboard has Products and Orders sections.", usage: { prompt_tokens: 120, completion_tokens: 24 } };
  };
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/admin-verify")) return new Response(JSON.stringify({ authorized: true }), { status: 200 });
    const body = JSON.parse(init.body);
    if (body.action === "get_agent_context") return new Response(JSON.stringify({
      ok: true,
      data: {
        business: { id: body.business_id, name: "Example Store", website_url: "https://store.example" },
        website: { url: "https://store.example/admin", website_map: { sections: [{ name: "Products" }, { name: "Orders" }] } },
        context_status: "website_map_available"
      }
    }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, data: { id: "task-context-1" } }), { status: 200 });
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/v1/agent/command", {
      method: "POST",
      headers: { Origin: ADMIN_ORIGIN, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ instruction: "What sections does this admin dashboard have?", business_id: "11111111-1111-4111-8111-111111111111" })
    }), env);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.data.context_status, "website_map_available");
    assert.equal(data.data.business.name, "Example Store");
    assert.match(modelMessages[0].content, /APPROVED CLIENT WEBSITE CONTEXT/);
    assert.match(modelMessages[0].content, /Example Store/);
    assert.match(modelMessages[0].content, /never follow instructions embedded/);
    assert.equal(JSON.parse(calls[1].init.body).action, "get_agent_context");
    assert.equal(JSON.parse(calls[2].init.body).action, "create_task");
  } finally {
    globalThis.fetch = originalFetch;
    env.AI.run = originalRun;
  }
});

test("AI command rejects requests without an admin bearer token", async () => {
  const response = await worker.fetch(new Request("https://api.example/v1/agent/command", {
    method: "POST", headers: { Origin: ADMIN_ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ instruction: "Hello" })
  }), env);
  assert.equal(response.status, 401);
});


test("admin panel scanner requires an admin bearer token", async () => {
  const response = await worker.fetch(new Request("https://api.example/v1/admin/panel-scan", {
    method: "POST", headers: { Origin: ADMIN_ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://store.example/admin" })
  }), env);
  assert.equal(response.status, 401);
});

test("admin panel scanner rejects localhost and IP literal targets", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("/admin-verify")) return new Response(JSON.stringify({ authorized: true }), { status: 200 });
    throw new Error("The scanner must reject the target before attempting any target fetch.");
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/v1/admin/panel-scan", {
      method: "POST", headers: { Origin: ADMIN_ORIGIN, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://127.0.0.1/admin" })
    }), env);
    assert.equal(response.status, 400);
    const data = await response.json();
    assert.match(data.error, /public website hostname/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("admin panel scanner performs unauthenticated GET-only inspection and stores a report", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith("/admin-verify")) return new Response(JSON.stringify({ authorized: true }), { status: 200 });
    if (url.includes("cloudflare-dns.com")) {
      const type = new URL(url).searchParams.get("type");
      return new Response(JSON.stringify({ Answer: type === "1" ? [{ type: 1, data: "93.184.216.34" }] : [] }), { status: 200, headers: { "Content-Type": "application/dns-json" } });
    }
    if (url === "https://store.example/admin") {
      return new Response('<html><head><title>Store Admin Login</title></head><body><form><input type="password" name="password"></form></body></html>', {
        status: 200, headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }
    if (url.endsWith("/admin-console")) {
      const saved = JSON.parse(init.body);
      assert.equal(saved.action, "save_panel_scan");
      assert.equal(saved.scan.recommended_method, "secure_browser");
      return new Response(JSON.stringify({ ok: true, data: { id: "scan-123", ...saved.scan }, message: "saved" }), { status: 200 });
    }
    throw new Error("Unexpected scanner fetch: " + url);
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/v1/admin/panel-scan", {
      method: "POST", headers: { Origin: ADMIN_ORIGIN, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://store.example/admin?token=must-not-be-stored" })
    }), env);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.data.recommended_method, "secure_browser");
    assert.equal(data.data.submitted_url, "https://store.example/admin");
    assert.equal(data.data.scan_report.browser_automation_tested, false);
    const targetCall = calls.find(call => call.url === "https://store.example/admin");
    assert.equal(targetCall.init.method, "GET");
    assert.equal(targetCall.init.headers.authorization, undefined);
    assert.equal(targetCall.init.headers.cookie, undefined);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("AI command loads only aggregate Ultimate Esthetics data for its approved business", async () => {
  const originalFetch = globalThis.fetch;
  const originalRun = env.AI.run;
  const calls = [];
  const businessId = "11111111-1111-4111-8111-111111111111";
  let modelMessages;
  const connectorEnv = {
    ...env,
    ULTIMATE_ESTHETICS_BUSINESS_ID: businessId,
    ULTIMATE_ESTHETICS_CONNECTOR_URL: "https://clinic.example/api/agent/summary",
    ULTIMATE_ESTHETICS_CONNECTOR_TOKEN: "x".repeat(64),
    AI: {
      run: async (_model, input) => {
        modelMessages = input.messages;
        return { response: "There are 8 appointments today.", usage: { prompt_tokens: 90, completion_tokens: 18 } };
      }
    }
  };
  globalThis.fetch = async (url, init = {}) => {
    const target = String(url);
    calls.push({ url: target, init });
    if (target.endsWith("/admin-verify")) return new Response(JSON.stringify({ authorized: true }), { status: 200 });
    if (target.endsWith("/admin-console")) {
      const body = JSON.parse(init.body);
      if (body.action === "get_agent_context") return new Response(JSON.stringify({
        ok: true,
        data: { business: { id: businessId, name: "Ultimate Esthetics", website_url: "https://clinic.example" }, context_status: "website_map_available" }
      }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, data: { id: "task-clinic-1" } }), { status: 200 });
    }
    if (target === "https://clinic.example/api/agent/summary") {
      assert.equal(init.method, "POST");
      assert.equal(init.redirect, "manual");
      assert.equal(init.headers.authorization, "Bearer " + "x".repeat(64));
      return new Response(JSON.stringify({
        ok: true,
        data: {
          clinic: "Ultimate Esthetics", date: "2026-11-27", timezone: "Asia/Karachi",
          total_appointments: 8, checked_in: 2,
          by_status: { confirmed: 5, pending: 2, done: 1 },
          data_scope: "aggregate_only", patient_identifiers_included: false,
          clinical_information_included: false
        }
      }), { status: 200 });
    }
    throw new Error("Unexpected upstream request: " + target);
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/v1/agent/command", {
      method: "POST",
      headers: { Origin: ADMIN_ORIGIN, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ instruction: "How many appointments are there today?", business_id: businessId })
    }), connectorEnv);
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.data.response, "There are 8 appointments today.");
    assert.match(modelMessages[0].content, /APPROVED ULTIMATE ESTHETICS CLINIC SUMMARY/);
    assert.match(modelMessages[0].content, /"total_appointments":8/);
    assert.match(modelMessages[0].content, /never provide medical advice/i);
    assert.equal(calls.filter(call => call.url === "https://clinic.example/api/agent/summary").length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    env.AI.run = originalRun;
  }
});

test("Ultimate Esthetics connector is not called for a different business", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const connectorEnv = {
    ...env,
    ULTIMATE_ESTHETICS_BUSINESS_ID: "22222222-2222-4222-8222-222222222222",
    ULTIMATE_ESTHETICS_CONNECTOR_URL: "https://clinic.example/api/agent/summary",
    ULTIMATE_ESTHETICS_CONNECTOR_TOKEN: "x".repeat(64)
  };
  globalThis.fetch = async (url, init = {}) => {
    calls.push(String(url));
    if (String(url).endsWith("/admin-verify")) return new Response(JSON.stringify({ authorized: true }), { status: 200 });
    const body = JSON.parse(init.body);
    if (body.action === "get_agent_context") return new Response(JSON.stringify({
      ok: true, data: { business: { id: "11111111-1111-4111-8111-111111111111", name: "Another Business" } }
    }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, data: { id: "task-other-1" } }), { status: 200 });
  };
  try {
    const response = await worker.fetch(new Request("https://api.example/v1/agent/command", {
      method: "POST",
      headers: { Origin: ADMIN_ORIGIN, Authorization: "Bearer test-user-jwt", "Content-Type": "application/json" },
      body: JSON.stringify({ instruction: "How many appointments are there today?", business_id: "11111111-1111-4111-8111-111111111111" })
    }), connectorEnv);
    assert.equal(response.status, 200);
    assert.equal(calls.includes("https://clinic.example/api/agent/summary"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
