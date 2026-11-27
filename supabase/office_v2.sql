-- FieldFlow Office v2 schema extension
-- Review and run in Supabase SQL Editor for project pldwrbjolcytodqedrqc.
-- Existing operational tables and records are preserved.

alter table public.businesses
  add column if not exists jar_quantity integer not null default 0,
  add column if not exists jar_price numeric(12,2) not null default 50,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

alter table public.organization_members
  add column if not exists member_color text;

create table if not exists public.finance_ledgers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  ledger_type text not null default 'both' check (ledger_type in ('expense','income','both')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  unique (organization_id, name)
);

create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_type text not null check (entry_type in ('expense','income')),
  ledger_id uuid references public.finance_ledgers(id),
  amount numeric(12,2) not null check (amount > 0),
  description text not null,
  entry_date date not null default current_date,
  business_id uuid references public.businesses(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id)
);

create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  item_type text not null check (item_type in ('image','pdf','note','text','other')),
  title text not null,
  folder text not null default 'General',
  content text,
  storage_path text,
  mime_type text,
  size_bytes bigint,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint vault_item_content_or_file check (
    item_type not in ('note','text') or content is not null
  )
);

create index if not exists businesses_org_customer_active_idx
  on public.businesses(organization_id, kind, created_at desc) where deleted_at is null;
create index if not exists finance_entries_org_date_idx
  on public.finance_entries(organization_id, entry_type, entry_date desc) where deleted_at is null;
create index if not exists vault_items_org_folder_idx
  on public.vault_items(organization_id, folder, created_at desc) where deleted_at is null;

alter table public.finance_ledgers enable row level security;
alter table public.finance_entries enable row level security;
alter table public.vault_items enable row level security;

drop policy if exists "FieldFlow members read finance ledgers" on public.finance_ledgers;
create policy "FieldFlow members read finance ledgers" on public.finance_ledgers
 for select to authenticated using (private.is_member(organization_id));
drop policy if exists "FieldFlow members create finance ledgers" on public.finance_ledgers;
create policy "FieldFlow members create finance ledgers" on public.finance_ledgers
 for insert to authenticated with check (private.is_member(organization_id) and created_by = (select auth.uid()));
drop policy if exists "FieldFlow members update finance ledgers" on public.finance_ledgers;
create policy "FieldFlow members update finance ledgers" on public.finance_ledgers
 for update to authenticated using (private.is_member(organization_id))
 with check (private.is_member(organization_id));

drop policy if exists "FieldFlow members read finance entries" on public.finance_entries;
create policy "FieldFlow members read finance entries" on public.finance_entries
 for select to authenticated using (private.is_member(organization_id));
drop policy if exists "FieldFlow members create finance entries" on public.finance_entries;
create policy "FieldFlow members create finance entries" on public.finance_entries
 for insert to authenticated with check (private.is_member(organization_id) and created_by = (select auth.uid()));
drop policy if exists "FieldFlow members update finance entries" on public.finance_entries;
create policy "FieldFlow members update finance entries" on public.finance_entries
 for update to authenticated using (private.is_member(organization_id))
 with check (private.is_member(organization_id));

drop policy if exists "FieldFlow members read vault items" on public.vault_items;
create policy "FieldFlow members read vault items" on public.vault_items
 for select to authenticated using (private.is_member(organization_id));
drop policy if exists "FieldFlow members create vault items" on public.vault_items;
create policy "FieldFlow members create vault items" on public.vault_items
 for insert to authenticated with check (private.is_member(organization_id) and created_by = (select auth.uid()));
drop policy if exists "FieldFlow members update vault items" on public.vault_items;
create policy "FieldFlow members update vault items" on public.vault_items
 for update to authenticated using (private.is_member(organization_id))
 with check (private.is_member(organization_id));

-- Private file access: object path starts with the organization UUID.
drop policy if exists "FieldFlow organization file read" on storage.objects;
create policy "FieldFlow organization file read" on storage.objects
 for select to authenticated using (
   bucket_id = 'fieldflow-private'
   and exists (select 1 from public.organization_members om
     where om.organization_id::text = (storage.foldername(name))[1]
       and om.user_id = (select auth.uid()) and om.active = true)
);
drop policy if exists "FieldFlow organization file upload" on storage.objects;
create policy "FieldFlow organization file upload" on storage.objects
 for insert to authenticated with check (
   bucket_id = 'fieldflow-private'
   and exists (select 1 from public.organization_members om
     where om.organization_id::text = (storage.foldername(name))[1]
       and om.user_id = (select auth.uid()) and om.active = true)
);

-- Audit records are append-only from the client. The existing audit_logs table
-- remains the source of truth for admin/manager review; no hard-delete policy is added.
grant select, insert, update on public.finance_ledgers, public.finance_entries, public.vault_items to authenticated;
