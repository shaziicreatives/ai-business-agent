# AI Business Agent

A multi-tenant business operations platform for inventory, orders, expenses and an AI business manager.

## Stack

- **Frontend:** Next.js App Router, React and TypeScript
- **Database and authentication:** Supabase
- **Backend API:** Cloudflare Workers
- **AI inference:** Cloudflare Workers AI (not connected yet)
- **Source control:** GitHub

## Run locally

1. Install Node.js 20.9 or newer.
2. Clone this repository.
3. Install dependencies with `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Add the Supabase project URL and publishable key when authentication is configured.
6. Run `npm run dev` and open http://localhost:3000.

## Security

Only Supabase publishable keys belong in `NEXT_PUBLIC_*` variables. Never commit service-role keys, database passwords, API tokens or other secrets.

## Current status

The initial responsive dashboard shell is committed. Dashboard metrics are placeholders until authentication and database-backed queries are connected. The AI manager is a UI preview and is not yet connected to a model.