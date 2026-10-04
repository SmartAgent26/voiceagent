-- Simulated block accounting: one block represents a 15-minute coaching interval.
alter table public.coaching_sessions add column if not exists blocks_charged integer not null default 0 check (blocks_charged >= 0);
create table public.simulated_block_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  blocks integer not null check (blocks > 0),
  created_at timestamptz not null default now()
);
create index simulated_block_purchases_user_created_idx on public.simulated_block_purchases(user_id, created_at desc);
alter table public.simulated_block_purchases enable row level security;
create policy simulated_block_purchases_select_self on public.simulated_block_purchases for select to authenticated using (user_id = auth.uid() or public.is_superadmin());
grant select on public.simulated_block_purchases to authenticated;
