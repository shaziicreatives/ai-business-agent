import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });
  try {
    const body = await req.json();
    // Honeypot field for basic bot filtering.
    if (clean(body.company_website, 200)) return Response.json({ ok: true }, { headers: cors });
    const business_name = clean(body.business_name, 140);
    const owner_name = clean(body.owner_name, 120);
    const contact_email = clean(body.contact_email, 254).toLowerCase();
    const contact_phone = clean(body.contact_phone, 40);
    const website_url = clean(body.website_url, 500);
    const platform = clean(body.platform, 60);
    const business_type = clean(body.business_type, 100);
    const message = clean(body.message, 1500);
    const requested_capabilities = Array.isArray(body.requested_capabilities)
      ? body.requested_capabilities.filter((v: unknown) => typeof v === "string").slice(0, 12).map((v: string) => v.slice(0, 60))
      : [];

    if (business_name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email)) {
      return Response.json({ error: "Business name and valid contact email are required." }, { status: 400, headers: cors });
    }
    if (website_url && !/^https?:\/\//i.test(website_url)) {
      return Response.json({ error: "Website URL must start with http:// or https://." }, { status: 400, headers: cors });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const { error } = await supabase.from("access_requests").insert({
      business_name, owner_name, contact_email, contact_phone, website_url, platform,
      business_type, requested_capabilities, message, submission_source: "public_form",
    });
    if (error) return Response.json({ error: "Request could not be saved. Please try again later." }, { status: 500, headers: cors });
    return Response.json({ ok: true, message: "Your access request has been received." }, { headers: cors });
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400, headers: cors });
  }
});