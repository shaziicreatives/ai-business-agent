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
    headers["access-control-allow-origin"] = origin;
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
      ai_model: true,
      business_integrations: false,
      automation_execution: false,
      ai_command_analysis: true
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
    } else if (request.method === "POST" && url.pathname === "/v1/agent/command") {
      const authorization = request.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer ")) {
        response = json({ ok: false, error: "Unauthorized", request_id: requestId }, 401, requestId, origin);
      } else if (!env.AI || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
        response = json({ ok: false, error: "AI command service is not configured", request_id: requestId }, 503, requestId, origin);
      } else {
        try {
          const raw = await request.arrayBuffer();
          if (raw.byteLength > 8192) throw new Error("Command is too large.");
          const body = JSON.parse(new TextDecoder().decode(raw) || "{}");
          const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";
          if (!instruction || instruction.length > 4000) {
            response = json({ ok: false, error: "Enter a command between 1 and 4000 characters.", request_id: requestId }, 400, requestId, origin);
          } else {
            const upstreamHeaders = { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization, "content-type": "application/json" };
            const verify = await fetch(`${env.SUPABASE_URL}/functions/v1/admin-verify`, { method: "POST", headers: upstreamHeaders, body: "{}" });
            const verified = await verify.json().catch(() => ({}));
            if (!verify.ok || !verified.authorized) {
              response = json({ ok: false, error: "Admin access denied", request_id: requestId }, verify.status || 403, requestId, origin);
            } else {
              const model = "@cf/zai-org/glm-4.7-flash";
              const result = await env.AI.run(model, {
                messages: [
                  { role: "system", content: "You are the private AI Business Agent assistant. Understand English, Urdu and Roman Urdu. Reply clearly and concisely in the user's language. You may analyze, explain, calculate, summarize and prepare plans. You have NO connected business tools in this phase: never claim you changed products, prices, stock, orders, accounts, sent messages, or performed any external action. If the user asks for an external action, explain that the relevant integration is not connected yet and state what access would be needed. Never request passwords or API secrets. Flag refunds, cancellations, deletions, financial transfers and price changes as actions requiring owner approval. Distinguish suggestions from completed actions." },
                  { role: "user", content: instruction }
                ],
                max_tokens: 700,
                temperature: 0.2
              });
              const answer = typeof result?.response === "string" ? result.response : JSON.stringify(result?.response ?? result);
              const usage = result?.usage || {};
              const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
              const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
              const neurons = Math.ceil(inputTokens * 5500 / 1000000 + outputTokens * 36400 / 1000000);
              const saved = await fetch(`${env.SUPABASE_URL}/functions/v1/admin-console`, {
                method: "POST", headers: upstreamHeaders,
                body: JSON.stringify({ action: "create_task", instruction, ai_result: {
                  response: answer, model, input_tokens: inputTokens, output_tokens: outputTokens,
                  neurons_estimate: neurons, usage_available: inputTokens > 0 || outputTokens > 0
                } })
              });
              const savedData = await saved.json().catch(() => ({}));
              if (!saved.ok || !savedData.ok) throw new Error(savedData.error || "Could not save command result.");
              response = json({ ok: true, data: { task_id: savedData.data?.id, response: answer, model, usage: { input_tokens: inputTokens, output_tokens: outputTokens, neurons_estimate: neurons, available: inputTokens > 0 || outputTokens > 0 } } }, 200, requestId, origin);
            }
          }
        } catch (error) {
          response = json({ ok: false, error: error instanceof Error ? error.message : "AI command failed", request_id: requestId }, 500, requestId, origin);
        }
      }
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