const ADMIN_ORIGIN = "https://ai-business-agent-admin.pages.dev";
const VERSION = "0.2.2";

function json(body, status, requestId, origin) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "x-request-id": requestId,
    "vary": "Origin"
  };
  if (origin === ADMIN_ORIGIN) {
    headers["access-control-allow-origin"] = ADMIN_ORIGIN;
    headers["access-control-allow-methods"] = "GET, OPTIONS";
    headers["access-control-allow-headers"] = "authorization, content-type, x-request-id";
    headers["access-control-max-age"] = "600";
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

function statusPayload() {
  return {
    ok: true,
    service: "ai-business-agent-api",
    version: VERSION,
    status: "foundation_only",
    runtime: "cloudflare-workers",
    capabilities: {
      health_checks: true,
      admin_api: false,
      ai_model: false,
      business_integrations: false,
      automation_execution: false
    }
  };
}

export default {
  async fetch(request) {
    const requestId = crypto.randomUUID();
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    let response;

    if (origin && origin !== ADMIN_ORIGIN) {
      response = json({ ok: false, error: "Origin not allowed", request_id: requestId }, 403, requestId, null);
    } else if (request.method === "OPTIONS") {
      response = json(null, 204, requestId, origin);
    } else if (request.method !== "GET") {
      response = json({ ok: false, error: "Method not allowed", request_id: requestId }, 405, requestId, origin);
    } else if (url.pathname === "/health" || url.pathname === "/v1/status") {
      response = json(statusPayload(), 200, requestId, origin);
    } else if (url.pathname === "/") {
      response = json({
        name: "AI Business Agent API",
        version: VERSION,
        status: "foundation_only",
        endpoints: { health: "/health", status: "/v1/status" }
      }, 200, requestId, origin);
    } else {
      response = json({ ok: false, error: "Not found", request_id: requestId }, 404, requestId, origin);
    }

    console.log(JSON.stringify({
      event: "http_request",
      request_id: requestId,
      method: request.method,
      path: url.pathname,
      status: response.status
    }));
    return response;
  }
};