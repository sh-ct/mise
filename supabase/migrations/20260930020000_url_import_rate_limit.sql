-- Rate limit for the import-url edge function: at most 20 imports per user per 10 minutes, so the function
-- can't be used as a free proxy or to burn CPU (docs/ARCHITECTURE.md#security).

create table private.url_import_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  requested_at timestamptz not null default now()
);

create index url_import_log_user_time_idx on private.url_import_log (user_id, requested_at desc);

revoke all on private.url_import_log from public, anon, authenticated;

-- Records an import for the calling user, or raises SQLSTATE PT429 (HTTP 429 through PostgREST) when the
-- user is over the limit. SECURITY DEFINER because the log table isn't accessible to users directly.
create function public.register_url_import()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  delete from private.url_import_log where user_id = v_user and requested_at < now() - interval '1 day';

  if (select count(*) from private.url_import_log
      where user_id = v_user and requested_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Too many imports. Try again in a few minutes.' using errcode = 'PT429';
  end if;

  insert into private.url_import_log (user_id) values (v_user);
end;
$$;

revoke all on function public.register_url_import() from public, anon;
grant execute on function public.register_url_import() to authenticated;
