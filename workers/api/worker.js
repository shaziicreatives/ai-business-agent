const ADMIN_ORIGIN = "https://ai-business-agent-admin.pages.dev";
function isAllowedOrigin(origin) { return origin === ADMIN_ORIGIN || /^https:\/\/[a-z0-9-]+\.ai-business-agent-admin\.pages\.dev$/.test(origin || ""); }
const VERSION = "0.4.0";
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
      ai_command_analysis: true,
      admin_panel_compatibility_scan: true,
      authenticated_browser_automation: false
    }
  };
}


const MAX_SCAN_BYTES = 48 * 1024;
function isPrivateIPv4(value) {
 const p=value.split(".").map(Number); if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return true;
 const [a,b,c]=p;
 return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||(b===0&&(c===0||c===2))))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113);
}
function isPrivateAddress(value) {
 const a=String(value||"").toLowerCase();
 if(a.includes(":")){if(a.startsWith("::ffff:"))return isPrivateIPv4(a.slice(7));return a==="::"||a==="::1"||a.startsWith("fc")||a.startsWith("fd")||/^fe[89ab]/.test(a)||a.startsWith("ff")||a.startsWith("2001:db8:")||a.startsWith("2001:10:");}
 return isPrivateIPv4(a);
}
async function assertPublicHostname(host) {
 if(!host||host.length>253||!host.includes(".")||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".test")||host.endsWith(".invalid")||/^\d+(\.\d+){3}$/.test(host)||host.includes(":"))throw new Error("Use a public website hostname, not localhost, a private address or an IP address.");
 const answers=await Promise.all([1,28].map(async type=>{const u=new URL("https://cloudflare-dns.com/dns-query");u.searchParams.set("name",host);u.searchParams.set("type",String(type));const r=await fetch(u,{headers:{accept:"application/dns-json"}});if(!r.ok)throw new Error("Could not verify public DNS records.");const d=await r.json();return(d.Answer||[]).filter(x=>x.type===type).map(x=>x.data);}));
 const addresses=answers.flat();if(!addresses.length)throw new Error("The hostname has no public A or AAAA DNS record.");if(addresses.some(isPrivateAddress))throw new Error("The website resolves to a private or reserved network address; scan blocked for safety.");
}
async function readLimitedText(response,limit=MAX_SCAN_BYTES){
 if(!response.body)return "";const reader=response.body.getReader(),chunks=[];let total=0;
 try{while(total<limit){const {value,done}=await reader.read();if(done)break;const part=value.byteLength>limit-total?value.slice(0,limit-total):value;chunks.push(part);total+=part.byteLength;if(part.byteLength<value.byteLength)break;}}finally{try{await reader.cancel();}catch{}}
 const joined=new Uint8Array(total);let offset=0;for(const c of chunks){joined.set(c,offset);offset+=c.byteLength;}return new TextDecoder().decode(joined);
}
async function passiveAdminPanelScan(input){
 let target;try{target=new URL(input.includes("://")?input:"https://"+input);}catch{throw new Error("Enter a valid Admin Panel URL.");}
 if(target.protocol!=="https:"||target.username||target.password||(target.port&&target.port!=="443")||!target.hostname)throw new Error("For safety, scan only public HTTPS URLs without embedded credentials or custom ports.");
 target.hash="";target.hostname=target.hostname.toLowerCase();await assertPublicHostname(target.hostname);
 const response=await fetch(target.toString(),{method:"GET",redirect:"manual",headers:{accept:"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5","user-agent":"AI-Business-Agent-Compatibility-Scanner/1.0"}});
 const contentType=response.headers.get("content-type")||"",body=/text|json|javascript/.test(contentType)?await readLimitedText(response):"",lower=body.toLowerCase();
 const title=(body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim().slice(0,160);
 const findings=[],recommendations=[],add=(label,status,detail)=>findings.push({label,status,detail});
 add("HTTPS transport","pass","Submitted URL uses HTTPS.");add("Public DNS","pass","Hostname resolved to public IP records.");add("Admin page response",response.status>=200&&response.status<400?"observed":"limited","Unauthenticated request returned HTTP "+response.status+(contentType?" ("+contentType.split(";")[0]+").":"."));
 const tech=[];if(/wp-content|wp-includes|wp-json/.test(lower))tech.push("WordPress indicators");if(/woocommerce|wc-ajax/.test(lower))tech.push("WooCommerce indicators");if(/cdn\.shopify\.com|shopify-section|myshopify/.test(lower))tech.push("Shopify indicators");if(/__next|_next\/static/.test(lower))tech.push("Next.js indicators");if(/__nuxt|_nuxt/.test(lower))tech.push("Nuxt indicators");if(/laravel|csrf-token/.test(lower))tech.push("Laravel indicators");if(/django|csrftoken/.test(lower))tech.push("Django indicators");if(/swagger|openapi/.test(lower))tech.push("API documentation indicators");
 if(tech.length)add("Software clues","detected",tech.join(", ")+". These are hints, not verified framework identity.");
 const loginRequired=[301,302,303,307,308,401,403].includes(response.status)||/type\s*=\s*["']password["']|name\s*=\s*["'](?:password|login)["']|sign in to continue|log in to continue/i.test(body);
 if(loginRequired){add("Authentication","required","Page appears to require login or redirect to authentication.");recommendations.push("Open a secure browser session and sign in yourself before testing the protected Admin Panel.");}
 let openApiFound=false;
 if(!loginRequired&&response.status>=200&&response.status<300){for(const path of ["/openapi.json","/.well-known/openapi.json","/swagger.json"]){const u=new URL(path,target.origin),r=await fetch(u,{method:"GET",redirect:"manual",headers:{accept:"application/json","user-agent":"AI-Business-Agent-Compatibility-Scanner/1.0"}});if(r.status===200&&(r.headers.get("content-type")||"").includes("json")){const t=await readLimitedText(r,24*1024);if(/["']?openapi["']?\s*:|["']?swagger["']?\s*:/.test(t)){openApiFound=true;add("API specification","detected","Public OpenAPI/Swagger specification found at "+path+".");break;}}}}
 let recommendedMethod="manual_review",confidence="low";
 if(openApiFound){recommendedMethod="api";confidence="high";recommendations.push("Review API authentication and least-privilege scopes before connecting.");}
 else if(loginRequired){recommendedMethod="secure_browser";recommendations.push("Authenticated browser inspection is the next test. This scan did not log in or access private records.");}
 else if(/wp-json/.test(lower)){recommendedMethod="api";confidence="medium";recommendations.push("A WordPress REST API clue was found; verify its endpoint and owner-authorized permissions.");}
 else recommendations.push("No public API specification was confirmed. Inspect the Admin Panel through an authenticated session or obtain documented API access.");
 if(!title)add("Page title","not_found","No readable page title was returned without authentication.");
 add("Private data access","not_tested","No login, cookies, passwords, OTPs or private business data were accessed.");add("Write operations","not_tested","GET requests only; the target website was not changed.");
 return{submitted_url:input.slice(0,2048),normalized_url:target.toString().slice(0,2048),scan_status:"completed",http_status:response.status,detected_stack:tech.join("; ")||"Not identified from public response",recommended_method:recommendedMethod,confidence,findings,recommendations,scan_report:{page_title:title||null,hostname:target.hostname,content_type:contentType.split(";")[0]||null,login_required:loginRequired,openapi_spec_found:openApiFound,inspection:"passive_unauthenticated_get_only",browser_automation_tested:false,api_access_verified:false,no_target_data_modified:true}};
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
          admin_panel_scan: "/v1/admin/panel-scan",
          access_requests: "/v1/access-requests"
        }
      }, 200, requestId, origin);

    } else if (request.method === "POST" && url.pathname === "/v1/admin/panel-scan") {
      const authorization = request.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer ")) {
        response = json({ ok: false, error: "Unauthorized", request_id: requestId }, 401, requestId, origin);
      } else if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
        response = json({ ok: false, error: "Scanner service is not configured", request_id: requestId }, 503, requestId, origin);
      } else {
        try {
          const raw = await request.arrayBuffer();
          if (raw.byteLength > 8192) throw new Error("Scan request is too large.");
          const body = JSON.parse(new TextDecoder().decode(raw) || "{}");
          const input = typeof body.url === "string" ? body.url.trim() : "";
          if (!input || input.length > 2048) throw new Error("Enter an Admin Panel URL (maximum 2048 characters).");
          const upstreamHeaders = { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization, "content-type": "application/json" };
          const verify = await fetch(env.SUPABASE_URL + "/functions/v1/admin-verify", { method: "POST", headers: upstreamHeaders, body: "{}" });
          const verified = await verify.json().catch(() => ({}));
          if (!verify.ok || !verified.authorized) {
            response = json({ ok: false, error: "Admin access denied", request_id: requestId }, 403, requestId, origin);
          } else {
            const scan = await passiveAdminPanelScan(input);
            const saved = await fetch(env.SUPABASE_URL + "/functions/v1/admin-console", { method: "POST", headers: upstreamHeaders, body: JSON.stringify({ action: "save_panel_scan", scan }) });
            const savedData = await saved.json().catch(() => ({}));
            if (!saved.ok || !savedData.ok) throw new Error(savedData.error || "Could not save scan history.");
            response = json({ ok: true, data: savedData.data, message: savedData.message }, 200, requestId, origin);
          }
        } catch (error) {
          response = json({ ok: false, error: error instanceof Error ? error.message : "Compatibility scan failed.", request_id: requestId }, 400, requestId, origin);
        }
      }
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
                  { role: "system", content: "You are the private AI Business Agent assistant. Understand English, Urdu and Roman Urdu. Reply clearly and concisely in the user's language. You may analyze, explain, calculate, summarize and prepare plans. Do not reveal internal reasoning; provide only the final answer. You have NO connected business tools in this phase: never claim you changed products, prices, stock, orders, accounts, sent messages, or performed any external action. If the user asks for an external action, explain that the relevant integration is not connected yet and state what access would be needed. Never request passwords or API secrets. Flag refunds, cancellations, deletions, financial transfers and price changes as actions requiring owner approval. Distinguish suggestions from completed actions." },
                  { role: "user", content: instruction }
                ],
                max_tokens: 1024,
                temperature: 0.2
              });
              const message = result?.choices?.[0]?.message;
              const answerValue = result?.response ?? message?.content ?? result?.result?.response;
              const answer = typeof answerValue === "string" ? answerValue : answerValue ? JSON.stringify(answerValue) : "I could not produce a final answer. Please try a shorter command.";
              const usage = result?.usage || {};
              const inputTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0);
              const outputTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0);
              const neurons = Number(usage.neurons ?? (inputTokens * 5500 / 1000000 + outputTokens * 36400 / 1000000).toFixed(4));
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