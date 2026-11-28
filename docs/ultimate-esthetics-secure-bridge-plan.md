# Ultimate Esthetics — Secure Clinic Bridge Plan

Status: DESIGN RECORDED — NOT ACTIVE. Preview only.

## Existing architecture
The central AI Worker currently verifies Supabase admin JWTs for `/v1/agent/command`. The clinic Admin Portal uses its own D1-backed HttpOnly `admin_token` session. These credentials are not interchangeable. Do not send the clinic cookie to the central Worker or accept browser-supplied identity claims.

## Proposed trust boundary
The clinic Pages Function validates its existing session with `getAdminSession` and creates a short-lived HMAC-signed assertion for the central Worker. The assertion is audience-bound, expires within 60 seconds, includes a unique `jti`, and is bound to a Super Admin-approved business UUID and permitted clinic role. Only `owner`, `admin`, and `receptionist` may use the initial aggregate-only summary verification. Preserve the signed role and do not elevate privileges. Future actions must be checked against the user's current clinic permissions. The HMAC secret exists only as a Preview secret in both server runtimes.

The central Worker validates the signature and all claims, rejects replay, then independently verifies the business is active and that Super Admin capability/action permissions and credits are enabled. It must never infer approval from the owner's consent alone.

## AI and credit gate
No model inference may occur until:
1. The business exists and is active in `authorized_businesses`.
2. Super Admin has explicitly enabled the clinic AI capability and required read-only permission.
3. The business has a valid, non-blocked credit account and available allocation.
4. An atomic, idempotent credit reservation succeeds.

After inference, settle from provider-reported usage. On inference failure, release the reservation. If provider usage is unavailable, do not claim exact actual cost; use a conservative documented settlement policy or fail closed. Concurrent requests must not exceed available credits or platform allocation.

The current `consume_ai_credits` RPC deducts a fixed amount immediately. It is not, by itself, a reserve/settle/release workflow. Add and test dedicated reservation, settlement and release RPCs before enabling clinic AI. Keep ledger entries immutable and idempotent.

## Initial clinic scope
- Read-only, aggregate-only clinic summary.
- No patient names, phone numbers, IDs, notes, invoices or individual records sent to the model.
- No appointment changes, check-ins, edits, refunds, deletions or other writes.
- No medical advice.
- No recording storage by default.
- Written responses remain mandatory; language support: Urdu, Roman Urdu and English.

## Required implementation components
- Clinic Pages Function bridge endpoint; same-origin browser request, existing D1 session check, role check, short-lived HMAC assertion.
- Worker route dedicated to clinic bridge assertions; separate from Supabase-admin JWT route.
- Server-side Supabase business/permission/credit checks.
- Atomic reserve/settle/release database functions and immutable ledger.
- Replay protection / idempotency.
- Audit events with actor, business, request ID, action, usage and outcome.
- Tests for authentication failures, signature/claim failures, approval denial, permission denial, zero credits, concurrency, duplicate requests, failed inference release, and data minimization.

## Preview-only configuration
Configure secrets only in isolated Preview runtimes:
- `AI_AGENT_BRIDGE_HMAC_SECRET` on clinic Pages Preview and `CLINIC_BRIDGE_HMAC_SECRET` on central AI Preview Worker (same random value, at least 32 bytes).
- `AI_AGENT_BUSINESS_ID=c55320e8-972d-48fd-be83-649c5d865df5` on clinic Pages Preview (approved business UUID).
- `SUPABASE_SERVICE_ROLE_KEY` only on central AI Preview Worker, as a secret.
- Any server-side Supabase credential only in the central Preview Worker secret store, never in browser code.

Do not use production secrets or production database bindings.

## Current state / hard blockers
- Ultimate Esthetics business row is active and its Access Request is approved.
- No AI credits have been allocated and no platform connection record exists.
- Clinic Preview is missing `AI_AGENT_BUSINESS_ID` and `AI_AGENT_BRIDGE_HMAC_SECRET`.
- Central Preview Worker is missing `CLINIC_BRIDGE_HMAC_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`.
- No atomic reservation/settlement/release lifecycle is in place.
- Do not activate the endpoint or call Workers AI until all gates and tests pass.

## Deployment safety
Implement only on `feature/ultimate-esthetics-connector`. Do not deploy the production Worker, alter production bindings/secrets, merge to `main`, or grant business approval automatically. Preview deployment requires a separate reviewed change.
