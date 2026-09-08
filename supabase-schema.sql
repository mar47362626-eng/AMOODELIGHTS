-- Run this in Supabase SQL Editor before starting the server with SUPABASE_SERVICE_ROLE_KEY.
-- The service-role key is used only by server.js and must never be placed in browser code.
create table if not exists public.app_data (
  entity text primary key,
  records jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

-- No client/browser policy is intentionally added. The server uses the service-role key.
create index if not exists app_data_updated_at_idx on public.app_data (updated_at desc);