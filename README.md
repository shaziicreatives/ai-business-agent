# Creative Clan — AI Business Agent

Private, owner-operated control plane for an AI business agent. This is **not** an inventory-management SaaS and does not provide client accounts, client dashboards, or client subscription pages.

## Product model

- Creative Clan operates one private Super Admin console for the owner and authorized internal staff.
- A business owner submits an access request through a separate public request form.
- The admin reviews the request. A business is not connected until its owner grants access through an official OAuth or supported delegated authorization flow.
- The agent is intended to work against the business's existing platform (for example Shopify or WooCommerce) using explicitly granted API scopes.
- The original commerce platform remains the source of truth. Product, stock, order, and customer datasets must not be copied into Supabase as a second inventory database.
- Supabase stores only the minimum control-plane data required: requests, connection metadata, secure secret references, tasks, approvals, audit events, and usage summaries.
- Sensitive actions (such as refunds, cancellations, destructive product changes, or price changes) require approval before execution.
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

- **Frontend:** Next.js App Router, React, TypeScript, statically exported to Cloudflare Pages
- **Control-plane database and auth:** Supabase
- **API, OAuth callbacks and webhooks:** Cloudflare Workers (integration runtime not yet activated)
- **AI inference:** Provider/model intentionally not selected or connected yet
- **Source control and deployment:** GitHub Actions → Cloudflare Pages

## Current deployment

- **Admin website:** https://ai-business-agent-admin.pages.dev
- **GitHub repository:** https://github.com/shaziicreatives/ai-business-agent
- **Supabase project:** `ai-business-agent` (Mumbai, Free tier)
- **Cloudflare Pages project:** `ai-business-agent-admin`
- GitHub Actions builds the static Next.js export and deploys the `out` directory to Cloudflare Pages on pushes to `main`.
- The production deployment has been created successfully. A successful static deployment does not, by itself, prove that authentication and all backend flows have passed end-to-end tests.

## Implemented

- Private admin login UI using Supabase Auth.
- Server-side admin verification through the `admin-verify` Edge Function. Only active `owner`, `admin`, or `operator` records are accepted.
- Public business access request form, backed by `submit-access-request`. It validates fields, uses a honeypot, and does not accept passwords or API keys.
- `admin-console` Edge Function verifies the bearer token and active admin role before reading or reviewing records.
- Admin console reads overview counts, access requests, authorized businesses, platform connection metadata, tasks, automation definitions, usage records, and audit events.
- Admin can approve or decline pending access requests. Approval creates an internal authorized-business record; it does not create a platform connection or grant platform permissions.
- Supabase project is active and healthy. The private control-plane schema is applied. All relevant tables have RLS enabled, with no browser-role policies; private data access is through server-side service-role functions.
- No demo businesses, requests, usage records, or fake activity have been seeded.

## Not yet implemented or verified

- Live end-to-end browser test of admin sign-in, authorization, dashboard data loading, and request submission/review.
- OAuth/delegated platform connections, token storage/rotation, revocation, and webhooks.
- AI provider/model selection, inference, agent orchestration, and tool execution.
- Automation scheduling and execution runtime.
- Real usage/cost metering and operational alerts.
- Auth hardening: Supabase leaked-password protection is currently reported disabled and should be enabled before production onboarding.
- Security and operational review of the Cloudflare API Worker; its existing health endpoint is a placeholder and it is not the production integration runtime.

## Security rules

- Never collect store passwords in an ordinary form.
- Use official OAuth / delegated authorization and least-privilege scopes wherever supported.
- Keep access tokens and refresh tokens server-side only; never expose them to browser code.
- Do not expose Supabase service-role keys in the frontend or commit secrets.
- Public request submissions must pass through a protected server endpoint with validation and abuse controls; do not grant anonymous users direct read access to private admin tables.
- Admin authorization must be enforced server-side, not only by hiding UI controls.
- Admin-only Edge Functions restrict browser CORS access to `https://ai-business-agent-admin.pages.dev`; the public access-request endpoint remains public by design.
- The `integration_secrets` table has no `anon` or `authenticated` table grants; secrets remain server-side only.
- RLS must remain enabled on exposed tables. Current private tables intentionally have no browser-role policies and are accessed by server-side functions only.
- High-impact business actions must remain approval-gated until a deliberate permissions policy is implemented and tested.

## Security hardening log (2026-11-25)

- Revoked all direct table privileges on `public.integration_secrets` from `anon` and `authenticated`; verified that no grants remain for those browser roles.
- Restricted CORS on `admin-console` and `admin-verify` to the production admin origin. Deployed `admin-console` v5 and `admin-verify` v4.
- Added 26 missing foreign-key indexes identified from PostgreSQL catalog checks and Supabase performance advisors.
- Re-ran Supabase advisors. The unindexed-foreign-key finding is cleared. Remaining findings: leaked-password protection disabled (must be enabled in Supabase Auth settings); 14 RLS init-plan performance warnings on workspace-related policies. The 44 unused-index notices are expected at this stage because the tables are empty and the new indexes have not yet seen workload. Ten RLS-enabled/no-policy notices on private admin tables are intentional: browser roles have no direct grants/policies and the server functions enforce admin authorization.

## Cost policy

Prefer free tiers and no-cost services. Check current limits before relying on a free tier. Do not activate paid services, AI providers, or upgrades without the owner's explicit approval.
