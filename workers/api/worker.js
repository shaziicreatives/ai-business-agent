const ADMIN_ORIGIN = "https://ai-business-agent-admin.pages.dev";
function isAllowedOrigin(origin) { return origin === ADMIN_ORIGIN || /^https:\/\/[a-z0-9-]+\.ai-business-agent-admin\.pages\.dev$/.test(origin || ""); }
const VERSION = "0.3.0";
const MAX_BODY_BYTES = 32 * 1024;

function headersFor(requestId, origin) {
  const headers = {
    "cache-control": "no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "x-request-id": requestId,
    "vary": "Origin"
  };
  if (isAllowedOrigin(origin)) {
    headers["access-control-allow-origin"] = ADMIN_ORIGIN;
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] = "authorization, content-type, x-request-id";
    headers["access-control-max-age"] = "600";
  }
  return headers;
}

function json(body, status, requestId, origin) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { ...headersFor(requestId, origin), "content-type": "application/json; charset=utf-8" }
  });
}

function statusPayload() {
  return {
    ok: true,
    service: "ai-business-agent-api",
    version: VERSION,
    status: "gateway_foundation",
    runtime: "cloudflare-workers",
    capabilities: {
      admin_api_gateway: true,
      public_access_requests: true,
      ai_model: false,
      business_integrations: false,
      automation_execution: false
    }
  };
}

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const origin = request.headers.get("Origin");
    const url = new URL(request.url);
    let response;

    if (origin && !isAllowedOrigin(origin)) {
      response = json({ ok: false, error: "Origin not allowed", request_id: requestId }, 403, requestId, null);
    } else if (request.method === "OPTIONS") {
      response = json(null, 204, requestId, origin);
    } else if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/v1/status")) {
      response = json(statusPayload(), 200, requestId, origin);
    } else if (request.method === "GET" && url.pathname === "/") {
      response = json({
        name: "AI Business Agent API",
        version: VERSION,
        status: "gateway_foundation",
        endpoints: {
          health: "/health",
          status: "/v1/status",
          admin_verify: "/v1/admin/verify",
          admin_console: "/v1/admin/console",
          access_requests: "/v1/access-requests"
        }
      }, 200, requestId, origin);
    } else {
      const routes = {
        "/v1/admin/verify": { functionName: "admin-verify", requiresAuth: true },
        "/v1/admin/console": { functionName: "admin-console", requiresAuth: true },
        "/v1/access-requests": { functionName: "submit-access-request", requiresAuth: false }
      };
      const route = routes[url.pathname];

      if (!route) {
        response = json({ ok: false, error: "Not found", request_id: requestId }, 404, requestId, origin);
      } else if (request.method !== "POST") {
        response = json({ ok: false, error: "Method not allowed", request_id: requestId }, 405, requestId, origin);
      } else if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
        response = json({ ok: false, error: "API gateway is not configured", request_id: requestId }, 503, requestId, origin);
      } else {
        const authorization = request.headers.get("Authorization");
        if (route.requiresAuth && !authorization?.startsWith("Bearer ")) {
          response = json({ ok: false, error: "Unauthorized", request_id: requestId }, 401, requestId, origin);
        } else {
          try {
            const body = await request.arrayBuffer();
            if (body.byteLength > MAX_BODY_BYTES) {
              response = json({ ok: false, error: "Request body is too large", request_id: requestId }, 413, requestId, origin);
            } else {
              const upstreamHeaders = {
                "apikey": env.SUPABASE_PUBLISHABLE_KEY,
                "content-type": "application/json"
              };
              if (route.requiresAuth) upstreamHeaders["authorization"] = authorization;

              const upstream = await fetch(
                `${env.SUPABASE_URL}/functions/v1/${route.functionName}`,
                { method: "POST", headers: upstreamHeaders, body, redirect: "manual" }
              );
              response = new Response(upstream.body, {
                status: upstream.status,
                headers: {
                  ...headersFor(requestId, origin),
                  "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
                }
              });
            }
          } catch (error) {
            console.error(JSON.stringify({
              event: "upstream_error",
              request_id: requestId,
              route: url.pathname,
              message: error instanceof Error ? error.message : "Unknown error"
            }));
            response = json({ ok: false, error: "Backend service unavailable", request_id: requestId }, 502, requestId, origin);
          }
        }
      }
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