create table if not exists public.admin_panel_scans (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  submitted_url text not null,
  normalized_url text not null,
  scan_status text not null default 'completed'
    check (scan_status in ('completed','blocked','failed')),
  http_status integer,
  detected_stack text,
  recommended_method text not null default 'manual_review'
    check (recommended_method in ('api','secure_browser','additional_access','manual_review')),
  confidence text not null default 'low'
    check (confidence in ('low','medium','high')),
  findings jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  scan_report jsonb not null default '{}'::jsonb,
  scanned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists admin_panel_scans_created_by_created_at_idx
  on public.admin_panel_scans (created_by, created_at desc);
alter table public.admin_panel_scans enable row level security;
revoke all on table public.admin_panel_scans from anon, authenticated;
grant all on table public.admin_panel_scans to service_role;
