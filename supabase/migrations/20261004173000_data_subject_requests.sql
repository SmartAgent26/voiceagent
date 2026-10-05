-- SEC-11: auditable requests for privacy rights; execution remains a controlled human process.
create type public.data_subject_request_type as enum ('export', 'rectification', 'erasure', 'withdraw_consent');
create type public.data_subject_request_status as enum ('pending', 'in_review', 'completed', 'rejected');

create table public.data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  request_type public.data_subject_request_type not null,
  status public.data_subject_request_status not null default 'pending',
  details text not null default '' check (char_length(details) <= 1200),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1200)
);

create index data_subject_requests_user_requested_idx on public.data_subject_requests(user_id, requested_at desc);
alter table public.data_subject_requests enable row level security;
create policy data_subject_requests_select_self on public.data_subject_requests for select to authenticated using (user_id = auth.uid());

create or replace function public.request_data_subject_right(p_request_type public.data_subject_request_type, p_details text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare request_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.data_subject_requests (user_id, request_type, details)
  values (auth.uid(), p_request_type, left(coalesce(p_details, ''), 1200))
  returning id into request_id;
  return request_id;
end;
$$;
revoke all on function public.request_data_subject_right(public.data_subject_request_type, text) from public;
grant execute on function public.request_data_subject_right(public.data_subject_request_type, text) to authenticated;
