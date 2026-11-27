# Ultimate Esthetics read-only connector (pilot)

This feature branch adds a first server-to-server connector between the Creative Clan AI Business Agent Worker and the Ultimate Esthetics Cloudflare Pages Functions API.

## What is implemented

- Ultimate Esthetics exposes `POST /api/agent/summary`.
- The clinic endpoint requires a unique bearer secret configured only on the Pages Functions runtime.
- The endpoint returns aggregate counts for today's appointments in `Asia/Karachi`.
- It does not return patient names, phone numbers, individual appointments, clinical notes, invoices, or other patient-identifying information.
- The AI Business Agent calls the endpoint only when the selected approved business ID exactly matches `ULTIMATE_ESTHETICS_BUSINESS_ID`.
- The AI receives the aggregate-only result as context and is explicitly instructed not to provide medical advice or claim that it changed clinic data.
- No appointment or patient write operation is exposed.

## Required runtime configuration

Configure these values on the `ai-business-agent-api` Cloudflare Worker, server-side only:

- `ULTIMATE_ESTHETICS_CONNECTOR_URL`: the full HTTPS URL ending in `/api/agent/summary`.
- `ULTIMATE_ESTHETICS_CONNECTOR_TOKEN`: the same unique random token configured on the Ultimate Esthetics Pages project (minimum 32 characters).
- `ULTIMATE_ESTHETICS_BUSINESS_ID`: the UUID of the active, approved Ultimate Esthetics business record in the AI Business Agent Supabase control plane.

Do not place the connector token in frontend code, a public environment variable, GitHub source, or a committed environment file. Do not send it through chat.

## Test

Run the AI Worker unit tests:

```bash
npm run test:worker
```

The tests cover the happy path, bearer-token forwarding, aggregate-only clinic context, and the business-ID boundary. Run the application build/lint separately before deployment.

## Deployment warning

The current Worker was originally configured in Cloudflare and this repository does not yet contain a complete Wrangler configuration describing all existing production bindings. Do not deploy with a bare `wrangler deploy` until the existing AI binding, Supabase variables, Browser Run configuration, and secret bindings have been inventoried and represented safely. A deployment can otherwise replace or omit runtime configuration.

This connector is a read-only pilot. It is not a production-ready multi-tenant connector framework and does not authorize patient-level access or write operations.
