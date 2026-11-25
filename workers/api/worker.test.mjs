import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.js";

const env = {
  SUPABASE_URL: "https://project.example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_only"
};
const ADMIN_ORIGIN = "https://ai-business-agent-admin.pages.dev";

test("health endpoint reports foundation capabilities and security headers", async () => {
  const response = await worker.fetch(new Request("https://api.example/health"), env);
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.service, "ai-business-agent-api");
  assert.equal(data.version, "0.3.0");
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
