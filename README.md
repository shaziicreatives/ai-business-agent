# Creative Clan — AI Business Agent

Private, owner-operated control plane for an autonomous AI business agent. This is **not** an inventory-management SaaS and does not provide client accounts, client dashboards, or client subscription pages.

## Product model

- Creative Clan operates one private Super Admin console for the owner and authorized internal staff.
- A business owner submits an access request through a separate public request form.
- The admin reviews the request. A business is not connected until its owner grants access through an official OAuth or supported delegated authorization flow.
- The agent works against the business's existing platform (for example Shopify or WooCommerce) using the granted API scopes.
- The original commerce platform remains the source of truth. Product, stock, order, and customer datasets must not be copied into Supabase as a second inventory database.
- Supabase stores only the minimum control-plane data required: requests, connection metadata, secure secret references, tasks, approvals, audit events, and usage summaries.
- Sensitive actions (such as refunds, cancellations, destructive product changes, or price changes) can require admin approval.
- Connections must be revocable and every consequential action must be auditable.

## Private admin modules

1. Overview
2. Access requests
3. Authorized businesses (internal access records only)
4. Website connections
5. AI control center
6. Automations
7. Task center
8. Usage and costs
9. Audit and security
10. Settings and internal roles

## Stack

- **Frontend:** Next.js App Router, React, TypeScript
- **Control-plane database and auth:** Supabase
- **API, OAuth callbacks and webhooks:** Cloudflare Workers
- **AI inference:** Provider to be selected and connected after evaluating free-tier limits and model suitability
- **Source control:** GitHub

## Security rules

- Never collect store passwords in an ordinary form.
- Use official OAuth / delegated authorization and least-privilege scopes wherever supported.
- Keep access tokens and refresh tokens server-side only; never expose them to browser code.
- Do not expose Supabase service-role keys in the frontend or commit secrets.
- Public request submissions must pass through a protected server endpoint with validation and abuse controls; do not grant anonymous users direct read access to private admin tables.
- Admin authorization must be enforced server-side, not only by hiding UI controls.
- RLS must be enabled on exposed tables and policies must reflect the private admin access model.

## Current implementation status

- The Next.js page is a **frontend foundation only**. It uses empty states and zero counts rather than invented businesses or demo activity.
- Supabase project is active. An additive private control-plane schema migration has been applied and verified. It adds private admin, access request, authorized business, connection metadata, approval, automation, task, usage and audit tables. These tables have RLS enabled, no browser-role policies, and explicit access is granted only to the backend service role. The earlier workspace/inventory tables were not deleted or repurposed.
- Cloudflare has two placeholder Workers. The API Worker currently exposes only a health endpoint; the preview Worker contains an obsolete inventory-demo UI. Neither is a production integration.
- Admin authentication, the public request pipeline, OAuth connections, AI provider/model, task execution, approvals, and live analytics are not yet connected.
- Do not describe the system as production-ready until these services are implemented and tested end-to-end.

## Run locally

1. Use Node.js 20.9 or newer.
2. Clone this repository and run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Add only the required public Supabase URL and publishable key to browser-exposed variables. Keep service credentials in server-side secrets.
5. Run `npm run dev` and open http://localhost:3000.

## Cost policy

Prefer free tiers and no-cost services. Check current limits before relying on a free tier. Do not activate paid services or upgrade plans without the owner's explicit approval.
