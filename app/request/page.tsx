"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

export default function AccessRequestPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("submit-access-request", { body: payload });
      if (invokeError || !data?.ok) throw new Error(data?.error || invokeError?.message || "Could not submit request.");
      setMessage("Request received. Creative Clan will review your details.");
      formElement.reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="request-screen">
    <form className="request-card" onSubmit={submit}>
      <a className="request-brand" href="/"> <img className="request-logo" src="/creative-clan-mark.svg" alt="Creative Clan" /><span>Creative <b>Clan</b></span></a>
      <p className="eyebrow">BUSINESS ACCESS REQUEST</p>
      <h1>Connect your existing business platform</h1>
      <p className="request-intro">Share your business details. Our team will review your request before any platform connection is authorized. Never submit passwords or API keys here.</p>
      <div className="request-grid">
        <label>Business name *<input name="business_name" required minLength={2} maxLength={140} placeholder="Your business name"/></label>
        <label>Your name<input name="owner_name" maxLength={120} placeholder="Business owner"/></label>
        <label>Contact email *<input name="contact_email" type="email" required maxLength={254} placeholder="you@example.com"/></label>
        <label>Phone / WhatsApp<input name="contact_phone" maxLength={40} placeholder="+92…"/></label>
        <label className="full">Website URL<input name="website_url" type="url" placeholder="https://yourstore.com"/></label>
        <label>Platform<select name="platform" defaultValue=""><option value="">Select platform</option><option>Shopify</option><option>WooCommerce</option><option>WordPress</option><option>Custom website</option><option>Other</option></select></label>
        <label>Business type<input name="business_type" maxLength={100} placeholder="Retail, fashion, electronics…"/></label>
        <label className="full">What would you like the AI agent to help with?<textarea name="message" rows={4} maxLength={1500} placeholder="Describe your requirements…"/></label>
      </div>
      <input className="honeypot" name="company_website" tabIndex={-1} autoComplete="off" aria-hidden="true"/>
      {error && <p className="request-error">{error}</p>}
      {message && <p className="request-success">{message}</p>}
      <button className="request-submit" disabled={busy}>{busy ? "Submitting…" : "Submit access request"}</button>
      <small>Submitting this form does not grant access. You will approve any official platform authorization separately.</small>
    </form>
  </main>;
}
