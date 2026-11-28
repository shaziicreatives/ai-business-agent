-- Schema-only baseline exported from the existing AI Agent database.

-- No production records, auth users, integration secrets, or storage objects are copied.

CREATE SCHEMA IF NOT EXISTS private;

CREATE SEQUENCE IF NOT EXISTS public.admin_invoice_number_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS public.access_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_name text NOT NULL,
  owner_name text,
  contact_email text NOT NULL,
  contact_phone text,
  website_url text,
  platform text,
  business_type text,
  requested_capabilities text[] DEFAULT '{}'::text[] NOT NULL,
  message text,
  status text DEFAULT 'pending'::text NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  submission_source text DEFAULT 'public_form'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_agent_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  automation_id uuid,
  task_type text NOT NULL,
  status text DEFAULT 'queued'::text NOT NULL,
  input jsonb DEFAULT '{}'::jsonb NOT NULL,
  output jsonb,
  error_message text,
  requires_approval boolean DEFAULT false NOT NULL,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_audit_events (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor_user_id uuid,
  business_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  outcome text DEFAULT 'success'::text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_branding (
  id boolean DEFAULT true NOT NULL,
  login_logo_url text,
  favicon_url text,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_browser_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  actor_user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  scan_id uuid NOT NULL,
  session_hash text NOT NULL,
  target_url text NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  inspected_at timestamp with time zone,
  closed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_invoices (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  invoice_number text NOT NULL,
  description text NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text DEFAULT 'PKR'::text NOT NULL,
  status text DEFAULT 'draft'::text NOT NULL,
  due_date date,
  issued_at timestamp with time zone,
  paid_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_notification_preferences (
  id boolean DEFAULT true NOT NULL,
  access_request_email boolean DEFAULT true NOT NULL,
  security_alert_email boolean DEFAULT true NOT NULL,
  task_completion_email boolean DEFAULT true NOT NULL,
  weekly_summary_email boolean DEFAULT false NOT NULL,
  updated_by uuid,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.admin_panel_scans (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  created_by uuid NOT NULL,
  submitted_url text NOT NULL,
  normalized_url text NOT NULL,
  scan_status text DEFAULT 'completed'::text NOT NULL,
  http_status integer,
  detected_stack text,
  recommended_method text DEFAULT 'manual_review'::text NOT NULL,
  confidence text DEFAULT 'low'::text NOT NULL,
  findings jsonb DEFAULT '[]'::jsonb NOT NULL,
  recommendations jsonb DEFAULT '[]'::jsonb NOT NULL,
  scan_report jsonb DEFAULT '{}'::jsonb NOT NULL,
  scanned_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  business_id uuid
);

CREATE TABLE IF NOT EXISTS public.admin_support_tickets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  subject text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'open'::text NOT NULL,
  priority text DEFAULT 'normal'::text NOT NULL,
  assigned_to uuid,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agent_approvals (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  task_id uuid,
  action_type text NOT NULL,
  action_summary text NOT NULL,
  proposed_payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  requested_by uuid,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agent_conversations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  site_id uuid,
  user_id uuid,
  channel text DEFAULT 'dashboard'::text NOT NULL,
  title text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  conversation_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  tool_name text,
  tool_result jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.agent_tasks (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  site_id uuid,
  requested_by uuid,
  task_type text NOT NULL,
  status text DEFAULT 'queued'::text NOT NULL,
  input jsonb DEFAULT '{}'::jsonb NOT NULL,
  output jsonb,
  error_message text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_credit_accounts (
  business_id uuid NOT NULL,
  monthly_quota bigint DEFAULT 0 NOT NULL,
  available_credits bigint DEFAULT 0 NOT NULL,
  used_this_period bigint DEFAULT 0 NOT NULL,
  low_balance_threshold bigint DEFAULT 0 NOT NULL,
  period_started_at timestamp with time zone DEFAULT date_trunc('month'::text, now()) NOT NULL,
  period_ends_at timestamp with time zone DEFAULT (date_trunc('month'::text, now()) + '1 mon'::interval) NOT NULL,
  is_blocked boolean DEFAULT false NOT NULL,
  block_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.ai_credit_ledger (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  entry_type text NOT NULL,
  amount bigint NOT NULL,
  balance_after bigint NOT NULL,
  reason text NOT NULL,
  idempotency_key text,
  actor_user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  actor_user_id uuid,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  details jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.authorized_businesses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  access_request_id uuid,
  business_name text NOT NULL,
  owner_name text,
  contact_email text,
  website_url text,
  platform text,
  status text DEFAULT 'active'::text NOT NULL,
  approved_by uuid,
  approved_at timestamp with time zone DEFAULT now() NOT NULL,
  internal_notes text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.automation_definitions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  trigger_config jsonb DEFAULT '{}'::jsonb NOT NULL,
  action_config jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_enabled boolean DEFAULT false NOT NULL,
  requires_approval boolean DEFAULT true NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  site_id uuid,
  category text NOT NULL,
  description text NOT NULL,
  vendor text,
  amount numeric(14,2) NOT NULL,
  currency character(3) DEFAULT 'PKR'::bpchar NOT NULL,
  expense_date date DEFAULT CURRENT_DATE NOT NULL,
  payment_method text,
  receipt_url text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.integration_secrets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  integration_id uuid NOT NULL,
  encrypted_payload text NOT NULL,
  key_version text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  rotated_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.inventory_levels (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  location_name text DEFAULT 'Default'::text NOT NULL,
  quantity numeric(14,3) DEFAULT 0 NOT NULL,
  reserved_quantity numeric(14,3) DEFAULT 0 NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  product_id uuid NOT NULL,
  site_id uuid,
  movement_type text NOT NULL,
  quantity numeric(14,3) NOT NULL,
  reference text,
  notes text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  product_id uuid,
  product_title text NOT NULL,
  sku text,
  quantity numeric(14,3) NOT NULL,
  unit_price numeric(14,2) NOT NULL,
  line_total numeric(14,2) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  site_id uuid,
  external_order_id text,
  order_number text,
  customer_name text,
  customer_email text,
  status text DEFAULT 'pending'::text NOT NULL,
  subtotal numeric(14,2) DEFAULT 0 NOT NULL,
  shipping_amount numeric(14,2) DEFAULT 0 NOT NULL,
  discount_amount numeric(14,2) DEFAULT 0 NOT NULL,
  total_amount numeric(14,2) DEFAULT 0 NOT NULL,
  currency character(3) DEFAULT 'PKR'::bpchar NOT NULL,
  ordered_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.platform_connections (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid NOT NULL,
  platform text NOT NULL,
  external_account_ref text,
  connection_status text DEFAULT 'pending'::text NOT NULL,
  granted_scopes text[] DEFAULT '{}'::text[] NOT NULL,
  secret_reference text,
  token_expires_at timestamp with time zone,
  connected_at timestamp with time zone,
  last_verified_at timestamp with time zone,
  revoked_at timestamp with time zone,
  connection_metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.private_admins (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  auth_user_id uuid NOT NULL,
  role text DEFAULT 'owner'::text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  site_id uuid,
  external_product_id text,
  sku text,
  title text NOT NULL,
  description text,
  price numeric(14,2),
  currency character(3) DEFAULT 'PKR'::bpchar NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.site_integrations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  site_id uuid NOT NULL,
  provider text NOT NULL,
  status text DEFAULT 'pending'::text NOT NULL,
  scopes text[] DEFAULT '{}'::text[] NOT NULL,
  connected_at timestamp with time zone,
  last_checked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.sites (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  name text NOT NULL,
  platform text DEFAULT 'custom'::text NOT NULL,
  base_url text NOT NULL,
  external_store_id text,
  status text DEFAULT 'pending'::text NOT NULL,
  last_synced_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.usage_records (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  business_id uuid,
  task_id uuid,
  provider text NOT NULL,
  model text,
  input_units bigint DEFAULT 0 NOT NULL,
  output_units bigint DEFAULT 0 NOT NULL,
  estimated_cost numeric(14,6) DEFAULT 0 NOT NULL,
  currency text DEFAULT 'USD'::text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  recorded_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'owner'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.admin_panel_scans ADD COLUMN IF NOT EXISTS business_id uuid;

ALTER TABLE access_requests ADD CONSTRAINT access_requests_pkey PRIMARY KEY (id);

ALTER TABLE admin_agent_tasks ADD CONSTRAINT admin_agent_tasks_pkey PRIMARY KEY (id);

ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_pkey PRIMARY KEY (id);

ALTER TABLE admin_branding ADD CONSTRAINT admin_branding_pkey PRIMARY KEY (id);

ALTER TABLE admin_browser_sessions ADD CONSTRAINT admin_browser_sessions_pkey PRIMARY KEY (id);

ALTER TABLE admin_invoices ADD CONSTRAINT admin_invoices_pkey PRIMARY KEY (id);

ALTER TABLE admin_notification_preferences ADD CONSTRAINT admin_notification_preferences_pkey PRIMARY KEY (id);

ALTER TABLE admin_notifications ADD CONSTRAINT admin_notifications_pkey PRIMARY KEY (id);

ALTER TABLE admin_panel_scans ADD CONSTRAINT admin_panel_scans_pkey PRIMARY KEY (id);

ALTER TABLE admin_support_tickets ADD CONSTRAINT admin_support_tickets_pkey PRIMARY KEY (id);

ALTER TABLE agent_approvals ADD CONSTRAINT agent_approvals_pkey PRIMARY KEY (id);

ALTER TABLE agent_conversations ADD CONSTRAINT agent_conversations_pkey PRIMARY KEY (id);

ALTER TABLE agent_messages ADD CONSTRAINT agent_messages_pkey PRIMARY KEY (id);

ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_pkey PRIMARY KEY (id);

ALTER TABLE ai_credit_accounts ADD CONSTRAINT ai_credit_accounts_pkey PRIMARY KEY (business_id);

ALTER TABLE ai_credit_ledger ADD CONSTRAINT ai_credit_ledger_pkey PRIMARY KEY (id);

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE authorized_businesses ADD CONSTRAINT authorized_businesses_pkey PRIMARY KEY (id);

ALTER TABLE automation_definitions ADD CONSTRAINT automation_definitions_pkey PRIMARY KEY (id);

ALTER TABLE expenses ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);

ALTER TABLE integration_secrets ADD CONSTRAINT integration_secrets_pkey PRIMARY KEY (id);

ALTER TABLE inventory_levels ADD CONSTRAINT inventory_levels_pkey PRIMARY KEY (id);

ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);

ALTER TABLE order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);

ALTER TABLE orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

ALTER TABLE platform_connections ADD CONSTRAINT platform_connections_pkey PRIMARY KEY (id);

ALTER TABLE private_admins ADD CONSTRAINT private_admins_pkey PRIMARY KEY (id);

ALTER TABLE products ADD CONSTRAINT products_pkey PRIMARY KEY (id);

ALTER TABLE site_integrations ADD CONSTRAINT site_integrations_pkey PRIMARY KEY (id);

ALTER TABLE sites ADD CONSTRAINT sites_pkey PRIMARY KEY (id);

ALTER TABLE usage_records ADD CONSTRAINT usage_records_pkey PRIMARY KEY (id);

ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);

ALTER TABLE workspaces ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);

ALTER TABLE admin_browser_sessions ADD CONSTRAINT admin_browser_sessions_session_hash_key UNIQUE (session_hash);

ALTER TABLE admin_invoices ADD CONSTRAINT admin_invoices_invoice_number_key UNIQUE (invoice_number);

ALTER TABLE ai_credit_ledger ADD CONSTRAINT ai_credit_ledger_idempotency_key_key UNIQUE (idempotency_key);

ALTER TABLE authorized_businesses ADD CONSTRAINT authorized_businesses_access_request_id_key UNIQUE (access_request_id);

ALTER TABLE integration_secrets ADD CONSTRAINT integration_secrets_integration_id_key UNIQUE (integration_id);

ALTER TABLE inventory_levels ADD CONSTRAINT inventory_levels_product_id_location_name_key UNIQUE (product_id, location_name);

ALTER TABLE orders ADD CONSTRAINT orders_site_id_external_order_id_key UNIQUE (site_id, external_order_id);

ALTER TABLE platform_connections ADD CONSTRAINT platform_connections_business_id_platform_external_account__key UNIQUE (business_id, platform, external_account_ref);

ALTER TABLE private_admins ADD CONSTRAINT private_admins_auth_user_id_key UNIQUE (auth_user_id);

ALTER TABLE products ADD CONSTRAINT products_site_id_external_product_id_key UNIQUE (site_id, external_product_id);

ALTER TABLE site_integrations ADD CONSTRAINT site_integrations_site_id_provider_key UNIQUE (site_id, provider);

ALTER TABLE sites ADD CONSTRAINT sites_workspace_id_base_url_key UNIQUE (workspace_id, base_url);

ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);

ALTER TABLE workspaces ADD CONSTRAINT workspaces_slug_key UNIQUE (slug);

CREATE INDEX access_requests_status_created_idx ON public.access_requests USING btree (status, created_at DESC);
CREATE INDEX idx_access_requests_reviewed_by ON public.access_requests USING btree (reviewed_by);

CREATE INDEX admin_agent_tasks_status_created_idx ON public.admin_agent_tasks USING btree (status, created_at DESC);
CREATE INDEX idx_admin_agent_tasks_automation_id ON public.admin_agent_tasks USING btree (automation_id);
CREATE INDEX idx_admin_agent_tasks_business_id ON public.admin_agent_tasks USING btree (business_id);

CREATE INDEX admin_audit_events_created_at_idx ON public.admin_audit_events USING btree (created_at DESC);
CREATE INDEX idx_admin_audit_events_actor_user_id ON public.admin_audit_events USING btree (actor_user_id);
CREATE INDEX idx_admin_audit_events_business_id ON public.admin_audit_events USING btree (business_id);

CREATE INDEX admin_browser_sessions_actor_status_idx ON public.admin_browser_sessions USING btree (actor_user_id, status, expires_at DESC);
CREATE INDEX admin_browser_sessions_business_created_idx ON public.admin_browser_sessions USING btree (business_id, created_at DESC);

CREATE INDEX admin_panel_scans_business_created_idx ON public.admin_panel_scans USING btree (business_id, created_at DESC);
CREATE INDEX admin_panel_scans_created_by_created_at_idx ON public.admin_panel_scans USING btree (created_by, created_at DESC);

CREATE INDEX agent_approvals_status_created_idx ON public.agent_approvals USING btree (status, created_at DESC);
CREATE INDEX idx_agent_approvals_business_id ON public.agent_approvals USING btree (business_id);
CREATE INDEX idx_agent_approvals_requested_by ON public.agent_approvals USING btree (requested_by);
CREATE INDEX idx_agent_approvals_reviewed_by ON public.agent_approvals USING btree (reviewed_by);
CREATE INDEX idx_agent_approvals_task_id ON public.agent_approvals USING btree (task_id);

CREATE INDEX idx_agent_conversations_site_id ON public.agent_conversations USING btree (site_id);
CREATE INDEX idx_agent_conversations_user_id ON public.agent_conversations USING btree (user_id);
CREATE INDEX idx_agent_conversations_workspace ON public.agent_conversations USING btree (workspace_id, created_at DESC);

CREATE INDEX idx_agent_messages_conversation ON public.agent_messages USING btree (conversation_id, created_at);

CREATE INDEX idx_agent_tasks_queue ON public.agent_tasks USING btree (status, created_at) WHERE (status = 'queued'::text);
CREATE INDEX idx_agent_tasks_requested_by ON public.agent_tasks USING btree (requested_by);
CREATE INDEX idx_agent_tasks_site_id ON public.agent_tasks USING btree (site_id);
CREATE INDEX idx_agent_tasks_workspace_id ON public.agent_tasks USING btree (workspace_id);

CREATE INDEX ai_credit_ledger_business_created_idx ON public.ai_credit_ledger USING btree (business_id, created_at DESC);

CREATE INDEX idx_audit_logs_actor_user_id ON public.audit_logs USING btree (actor_user_id);
CREATE INDEX idx_audit_logs_workspace ON public.audit_logs USING btree (workspace_id, created_at DESC);

CREATE INDEX authorized_businesses_status_idx ON public.authorized_businesses USING btree (status);
CREATE INDEX idx_authorized_businesses_approved_by ON public.authorized_businesses USING btree (approved_by);

CREATE INDEX idx_automation_definitions_business_id ON public.automation_definitions USING btree (business_id);
CREATE INDEX idx_automation_definitions_created_by ON public.automation_definitions USING btree (created_by);

CREATE INDEX idx_expenses_site_id ON public.expenses USING btree (site_id);
CREATE INDEX idx_expenses_workspace_date ON public.expenses USING btree (workspace_id, expense_date DESC);

CREATE INDEX idx_inventory_workspace_product ON public.inventory_levels USING btree (workspace_id, product_id);

CREATE INDEX idx_inventory_movements_product_id ON public.inventory_movements USING btree (product_id);
CREATE INDEX idx_inventory_movements_site_id ON public.inventory_movements USING btree (site_id);
CREATE INDEX idx_inventory_movements_workspace_date ON public.inventory_movements USING btree (workspace_id, created_at DESC);

CREATE INDEX idx_order_items_order_id ON public.order_items USING btree (order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);

CREATE INDEX idx_orders_workspace_date ON public.orders USING btree (workspace_id, ordered_at DESC);

CREATE INDEX platform_connections_business_status_idx ON public.platform_connections USING btree (business_id, connection_status);

CREATE INDEX idx_products_workspace ON public.products USING btree (workspace_id);

CREATE INDEX idx_site_integrations_workspace_id ON public.site_integrations USING btree (workspace_id);

CREATE INDEX idx_sites_workspace ON public.sites USING btree (workspace_id);

CREATE INDEX idx_usage_records_business_id ON public.usage_records USING btree (business_id);
CREATE INDEX idx_usage_records_task_id ON public.usage_records USING btree (task_id);
CREATE INDEX usage_records_recorded_at_idx ON public.usage_records USING btree (recorded_at DESC);

CREATE INDEX idx_workspace_members_user ON public.workspace_members USING btree (user_id);

ALTER TABLE access_requests ADD CONSTRAINT access_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'under_review'::text, 'approved'::text, 'declined'::text, 'withdrawn'::text])));

ALTER TABLE admin_agent_tasks ADD CONSTRAINT admin_agent_tasks_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'awaiting_approval'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])));

ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_outcome_check CHECK ((outcome = ANY (ARRAY['success'::text, 'denied'::text, 'failed'::text])));

ALTER TABLE admin_branding ADD CONSTRAINT admin_branding_id_check CHECK ((id = true));

ALTER TABLE admin_browser_sessions ADD CONSTRAINT admin_browser_sessions_https_url CHECK ((target_url ~~ 'https://%'::text));
ALTER TABLE admin_browser_sessions ADD CONSTRAINT admin_browser_sessions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inspected'::text, 'expired'::text, 'revoked'::text, 'failed'::text])));
ALTER TABLE admin_browser_sessions ADD CONSTRAINT admin_browser_sessions_hash_format CHECK ((session_hash ~ '^[a-f0-9]{64}$'::text));

ALTER TABLE admin_invoices ADD CONSTRAINT admin_invoices_amount_check CHECK ((amount >= (0)::numeric));
ALTER TABLE admin_invoices ADD CONSTRAINT admin_invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'paid'::text, 'overdue'::text, 'void'::text])));

ALTER TABLE admin_notification_preferences ADD CONSTRAINT admin_notification_preferences_id_check CHECK (id);

ALTER TABLE admin_panel_scans ADD CONSTRAINT admin_panel_scans_confidence_check CHECK ((confidence = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text])));
ALTER TABLE admin_panel_scans ADD CONSTRAINT admin_panel_scans_recommended_method_check CHECK ((recommended_method = ANY (ARRAY['api'::text, 'secure_browser'::text, 'additional_access'::text, 'manual_review'::text])));
ALTER TABLE admin_panel_scans ADD CONSTRAINT admin_panel_scans_scan_status_check CHECK ((scan_status = ANY (ARRAY['completed'::text, 'blocked'::text, 'failed'::text])));

ALTER TABLE admin_support_tickets ADD CONSTRAINT admin_support_tickets_message_check CHECK (((char_length(message) >= 3) AND (char_length(message) <= 10000)));
ALTER TABLE admin_support_tickets ADD CONSTRAINT admin_support_tickets_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text, 'urgent'::text])));
ALTER TABLE admin_support_tickets ADD CONSTRAINT admin_support_tickets_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])));
ALTER TABLE admin_support_tickets ADD CONSTRAINT admin_support_tickets_subject_check CHECK (((char_length(subject) >= 3) AND (char_length(subject) <= 200)));

ALTER TABLE agent_approvals ADD CONSTRAINT agent_approvals_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'expired'::text, 'cancelled'::text])));

ALTER TABLE agent_conversations ADD CONSTRAINT agent_conversations_channel_check CHECK ((channel = ANY (ARRAY['dashboard'::text, 'voice'::text, 'widget'::text, 'api'::text])));

ALTER TABLE agent_messages ADD CONSTRAINT agent_messages_role_check CHECK ((role = ANY (ARRAY['system'::text, 'user'::text, 'assistant'::text, 'tool'::text])));

ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])));

ALTER TABLE ai_credit_accounts ADD CONSTRAINT ai_credit_accounts_available_credits_check CHECK ((available_credits >= 0));
ALTER TABLE ai_credit_accounts ADD CONSTRAINT ai_credit_accounts_low_balance_threshold_check CHECK ((low_balance_threshold >= 0));
ALTER TABLE ai_credit_accounts ADD CONSTRAINT ai_credit_accounts_monthly_quota_check CHECK ((monthly_quota >= 0));
ALTER TABLE ai_credit_accounts ADD CONSTRAINT ai_credit_accounts_used_this_period_check CHECK ((used_this_period >= 0));

ALTER TABLE ai_credit_ledger ADD CONSTRAINT ai_credit_ledger_amount_check CHECK ((amount <> 0));
ALTER TABLE ai_credit_ledger ADD CONSTRAINT ai_credit_ledger_entry_type_check CHECK ((entry_type = ANY (ARRAY['monthly_grant'::text, 'top_up'::text, 'consumption'::text, 'adjustment'::text, 'refund'::text])));
ALTER TABLE ai_credit_ledger ADD CONSTRAINT ai_credit_ledger_balance_after_check CHECK ((balance_after >= 0));

ALTER TABLE authorized_businesses ADD CONSTRAINT authorized_businesses_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text, 'revoked'::text, 'archived'::text])));

ALTER TABLE expenses ADD CONSTRAINT expenses_amount_check CHECK ((amount >= (0)::numeric));

ALTER TABLE inventory_levels ADD CONSTRAINT inventory_levels_reserved_quantity_check CHECK ((reserved_quantity >= (0)::numeric));

ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_movement_type_check CHECK ((movement_type = ANY (ARRAY['in'::text, 'out'::text, 'adjustment'::text, 'sale'::text, 'return'::text, 'transfer'::text])));

ALTER TABLE platform_connections ADD CONSTRAINT platform_connections_connection_status_check CHECK ((connection_status = ANY (ARRAY['pending'::text, 'active'::text, 'expired'::text, 'revoked'::text, 'error'::text])));

ALTER TABLE private_admins ADD CONSTRAINT private_admins_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'operator'::text, 'viewer'::text])));

ALTER TABLE products ADD CONSTRAINT products_status_check CHECK ((status = ANY (ARRAY['active'::text, 'draft'::text, 'archived'::text])));

ALTER TABLE site_integrations ADD CONSTRAINT site_integrations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'connected'::text, 'error'::text, 'revoked'::text])));

ALTER TABLE sites ADD CONSTRAINT sites_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'connected'::text, 'error'::text, 'paused'::text])));

ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'manager'::text, 'staff'::text, 'viewer'::text])));

ALTER TABLE access_requests ADD CONSTRAINT access_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE admin_agent_tasks ADD CONSTRAINT admin_agent_tasks_automation_id_fkey FOREIGN KEY (automation_id) REFERENCES automation_definitions(id) ON DELETE SET NULL;
ALTER TABLE admin_agent_tasks ADD CONSTRAINT admin_agent_tasks_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE SET NULL;

ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE admin_audit_events ADD CONSTRAINT admin_audit_events_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE SET NULL;

ALTER TABLE admin_branding ADD CONSTRAINT admin_branding_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE admin_browser_sessions ADD CONSTRAINT admin_browser_sessions_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE admin_browser_sessions ADD CONSTRAINT admin_browser_sessions_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE CASCADE;
ALTER TABLE admin_browser_sessions ADD CONSTRAINT admin_browser_sessions_scan_id_fkey FOREIGN KEY (scan_id) REFERENCES admin_panel_scans(id) ON DELETE CASCADE;

ALTER TABLE admin_invoices ADD CONSTRAINT admin_invoices_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE SET NULL;

ALTER TABLE admin_panel_scans ADD CONSTRAINT admin_panel_scans_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE CASCADE;
ALTER TABLE admin_panel_scans ADD CONSTRAINT admin_panel_scans_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE admin_support_tickets ADD CONSTRAINT admin_support_tickets_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE SET NULL;

ALTER TABLE agent_approvals ADD CONSTRAINT agent_approvals_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE CASCADE;
ALTER TABLE agent_approvals ADD CONSTRAINT agent_approvals_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE agent_approvals ADD CONSTRAINT agent_approvals_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE agent_approvals ADD CONSTRAINT agent_approvals_task_id_fkey FOREIGN KEY (task_id) REFERENCES admin_agent_tasks(id) ON DELETE SET NULL;

ALTER TABLE agent_conversations ADD CONSTRAINT agent_conversations_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE agent_conversations ADD CONSTRAINT agent_conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE agent_conversations ADD CONSTRAINT agent_conversations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE agent_messages ADD CONSTRAINT agent_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES agent_conversations(id) ON DELETE CASCADE;

ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE ai_credit_accounts ADD CONSTRAINT ai_credit_accounts_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE RESTRICT;

ALTER TABLE ai_credit_ledger ADD CONSTRAINT ai_credit_ledger_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE RESTRICT;
ALTER TABLE ai_credit_ledger ADD CONSTRAINT ai_credit_ledger_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE authorized_businesses ADD CONSTRAINT authorized_businesses_access_request_id_fkey FOREIGN KEY (access_request_id) REFERENCES access_requests(id) ON DELETE SET NULL;
ALTER TABLE authorized_businesses ADD CONSTRAINT authorized_businesses_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE automation_definitions ADD CONSTRAINT automation_definitions_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE CASCADE;
ALTER TABLE automation_definitions ADD CONSTRAINT automation_definitions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE expenses ADD CONSTRAINT expenses_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD CONSTRAINT expenses_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE integration_secrets ADD CONSTRAINT integration_secrets_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES site_integrations(id) ON DELETE CASCADE;

ALTER TABLE inventory_levels ADD CONSTRAINT inventory_levels_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE inventory_levels ADD CONSTRAINT inventory_levels_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE orders ADD CONSTRAINT orders_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE orders ADD CONSTRAINT orders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE platform_connections ADD CONSTRAINT platform_connections_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE CASCADE;

ALTER TABLE private_admins ADD CONSTRAINT private_admins_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE products ADD CONSTRAINT products_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE SET NULL;
ALTER TABLE products ADD CONSTRAINT products_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE site_integrations ADD CONSTRAINT site_integrations_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE site_integrations ADD CONSTRAINT site_integrations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE sites ADD CONSTRAINT sites_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE usage_records ADD CONSTRAINT usage_records_business_id_fkey FOREIGN KEY (business_id) REFERENCES authorized_businesses(id) ON DELETE SET NULL;
ALTER TABLE usage_records ADD CONSTRAINT usage_records_task_id_fkey FOREIGN KEY (task_id) REFERENCES admin_agent_tasks(id) ON DELETE SET NULL;

ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_agent_tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_branding ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_browser_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_invoices ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_notification_preferences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_panel_scans ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.admin_support_tickets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_approvals ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_credit_accounts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.authorized_businesses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.automation_definitions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inventory_levels ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.platform_connections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.private_admins ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.site_integrations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branding is publicly readable" ON public.admin_branding AS PERMISSIVE FOR SELECT TO anon,authenticated USING (true);

CREATE POLICY "workspace members can access conversations" ON public.agent_conversations AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = agent_conversations.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = agent_conversations.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workspace members can access messages" ON public.agent_messages AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM (agent_conversations c
     JOIN workspace_members m ON ((m.workspace_id = c.workspace_id)))
  WHERE ((c.id = agent_messages.conversation_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (agent_conversations c
     JOIN workspace_members m ON ((m.workspace_id = c.workspace_id)))
  WHERE ((c.id = agent_messages.conversation_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workspace members can access agent tasks" ON public.agent_tasks AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = agent_tasks.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = agent_tasks.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workspace members can view audit logs" ON public.audit_logs AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = audit_logs.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workspace members can access expenses" ON public.expenses AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = expenses.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = expenses.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workspace members can access inventory levels" ON public.inventory_levels AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = inventory_levels.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = inventory_levels.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workspace members can access inventory movements" ON public.inventory_movements AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = inventory_movements.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = inventory_movements.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workspace members can access order items" ON public.order_items AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM (orders o
     JOIN workspace_members m ON ((m.workspace_id = o.workspace_id)))
  WHERE ((o.id = order_items.order_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (orders o
     JOIN workspace_members m ON ((m.workspace_id = o.workspace_id)))
  WHERE ((o.id = order_items.order_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workspace members can access orders" ON public.orders AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = orders.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = orders.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workspace members can access products" ON public.products AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = products.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = products.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workspace members can access integrations" ON public.site_integrations AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = site_integrations.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = site_integrations.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "workspace members can access sites" ON public.sites AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = sites.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = sites.workspace_id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY "members can view own memberships" ON public.workspace_members AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "members can view their workspaces" ON public.workspaces AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM workspace_members m
  WHERE ((m.workspace_id = workspaces.id) AND (m.user_id = ( SELECT auth.uid() AS uid))))));

CREATE OR REPLACE FUNCTION private.is_active_admin_for_branding()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.private_admins p
    where p.auth_user_id = (select auth.uid())
      and p.is_active = true
      and p.role in ('owner','admin','operator')
  );
$function$;

CREATE OR REPLACE FUNCTION public.admin_add_ai_credits(p_business_id uuid, p_amount bigint, p_entry_type text, p_reason text, p_actor_user_id uuid, p_idempotency_key text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_ledger public.ai_credit_ledger%rowtype;
begin
  if p_amount <= 0 then raise exception 'Credit amount must be greater than zero'; end if;
  if p_entry_type not in ('monthly_grant','top_up','refund') then raise exception 'Invalid credit entry type'; end if;
  if length(trim(coalesce(p_reason,''))) < 3 then raise exception 'A reason is required'; end if;
  insert into public.ai_credit_accounts (business_id) values (p_business_id) on conflict (business_id) do nothing;
  select * into v_account from public.ai_credit_accounts where business_id = p_business_id for update;
  if p_idempotency_key is not null then
    select * into v_ledger from public.ai_credit_ledger where idempotency_key = p_idempotency_key;
    if found then
      if v_ledger.business_id <> p_business_id or v_ledger.amount <> p_amount or v_ledger.entry_type <> p_entry_type then
        raise exception 'Idempotency key was already used for a different credit operation';
      end if;
      return jsonb_build_object('ok', true, 'duplicate', true, 'balance', v_ledger.balance_after, 'ledger_id', v_ledger.id);
    end if;
  end if;
  update public.ai_credit_accounts
    set available_credits = available_credits + p_amount,
        is_blocked = false, block_reason = null, updated_at = now()
    where business_id = p_business_id returning * into v_account;
  insert into public.ai_credit_ledger
    (business_id, entry_type, amount, balance_after, reason, idempotency_key, actor_user_id)
  values (p_business_id, p_entry_type, p_amount, v_account.available_credits, trim(p_reason), p_idempotency_key, p_actor_user_id)
  returning * into v_ledger;
  return jsonb_build_object('ok', true, 'duplicate', false, 'balance', v_account.available_credits, 'ledger_id', v_ledger.id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.consume_ai_credits(p_business_id uuid, p_amount bigint, p_idempotency_key text, p_reason text DEFAULT 'AI usage'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_account public.ai_credit_accounts%rowtype;
  v_ledger public.ai_credit_ledger%rowtype;
begin
  if p_amount <= 0 then raise exception 'Consumption amount must be greater than zero'; end if;
  if length(trim(coalesce(p_idempotency_key,''))) < 8 then raise exception 'A valid idempotency key is required'; end if;
  select * into v_ledger from public.ai_credit_ledger where idempotency_key = p_idempotency_key;
  if found then
    if v_ledger.business_id <> p_business_id or v_ledger.amount <> -p_amount or v_ledger.entry_type <> 'consumption' then
      raise exception 'Idempotency key was already used for a different operation';
    end if;
    return jsonb_build_object('ok', true, 'duplicate', true, 'balance', v_ledger.balance_after);
  end if;
  select * into v_account from public.ai_credit_accounts where business_id = p_business_id for update;
  if not found then return jsonb_build_object('ok', false, 'blocked', true, 'reason', 'No credit account configured', 'balance', 0); end if;
  if v_account.period_ends_at <= now() then
    update public.ai_credit_accounts set used_this_period = 0,
      period_started_at = now(), period_ends_at = now() + interval '1 month',
      is_blocked = false, block_reason = null, updated_at = now()
      where business_id = p_business_id returning * into v_account;
  end if;
  if v_account.monthly_quota <= 0 then
    update public.ai_credit_accounts set is_blocked = true, block_reason = 'Monthly quota is not configured', updated_at = now() where business_id = p_business_id;
    return jsonb_build_object('ok', false, 'blocked', true, 'reason', 'Monthly quota is not configured', 'balance', v_account.available_credits);
  end if;
  if v_account.is_blocked or v_account.available_credits < p_amount or v_account.used_this_period + p_amount > v_account.monthly_quota then
    update public.ai_credit_accounts set is_blocked = true,
      block_reason = case when available_credits < p_amount then 'Insufficient AI credits' else 'Monthly quota reached' end,
      updated_at = now() where business_id = p_business_id;
    return jsonb_build_object('ok', false, 'blocked', true, 'reason', case when v_account.available_credits < p_amount then 'Insufficient AI credits' else 'Monthly quota reached' end, 'balance', v_account.available_credits);
  end if;
  update public.ai_credit_accounts set available_credits = available_credits - p_amount,
    used_this_period = used_this_period + p_amount, updated_at = now()
    where business_id = p_business_id returning * into v_account;
  insert into public.ai_credit_ledger
    (business_id, entry_type, amount, balance_after, reason, idempotency_key)
  values (p_business_id, 'consumption', -p_amount, v_account.available_credits,
    left(coalesce(nullif(trim(p_reason),''),'AI usage'), 500), p_idempotency_key);
  return jsonb_build_object('ok', true, 'duplicate', false, 'balance', v_account.available_credits);
end;
$function$;

CREATE OR REPLACE FUNCTION public.create_workspace(workspace_name text, workspace_slug text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  new_workspace_id uuid;
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if length(trim(workspace_name)) < 2 or length(trim(workspace_slug)) < 3 then
    raise exception 'Workspace name and slug are too short';
  end if;

  insert into public.workspaces (name, slug, created_by)
  values (trim(workspace_name), lower(trim(workspace_slug)), current_user_id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, current_user_id, 'owner');

  return new_workspace_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.next_admin_invoice_number()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select 'INV-' || lpad(nextval('public.admin_invoice_number_seq')::text, 4, '0');
$function$;

CREATE OR REPLACE FUNCTION public.prevent_ai_credit_ledger_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  raise exception 'AI credit ledger is append-only';
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.agent_conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER ai_credit_ledger_no_mutation BEFORE DELETE OR UPDATE ON public.ai_credit_ledger FOR EACH ROW EXECUTE FUNCTION prevent_ai_credit_ledger_mutation();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.site_integrations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sites FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION set_updated_at();