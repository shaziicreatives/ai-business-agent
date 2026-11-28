import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return Response.json({ authorized: false }, { status: 401, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const token = auth.slice(7);
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) return Response.json({ authorized: false }, { status: 401, headers: cors });

  const { data, error } = await admin
    .from("private_admins")
    .select("role,is_active")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (error) return Response.json({ error: "Could not verify admin access" }, { status: 500, headers: cors });
  if (!data || !data.is_active || !["owner", "admin", "operator"].includes(data.role)) {
    return Response.json({ authorized: false }, { status: 403, headers: cors });
  }
  return Response.json({ authorized: true, role: data.role, email: userData.user.email }, { headers: cors });
});