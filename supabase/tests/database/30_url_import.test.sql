-- register_url_import: per-user rate limit for the import-url edge function.
begin;
select plan(8);

select tests.create_user('a0000000-0000-4000-8000-00000000000a', 'alice@example.test');
select tests.create_user('b0000000-0000-4000-8000-00000000000b', 'bob@example.test');

select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select public.register_url_import() from generate_series(1, 20) $$,
  'allows 20 imports in 10 minutes'
);
select throws_ok($$ select public.register_url_import() $$, 'PT429', null, 'refuses the 21st');

select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select lives_ok($$ select public.register_url_import() $$, 'limits are per user');
select throws_ok($$ select count(*) from private.url_import_log $$, '42501', null, 'users cannot read the log');

-- The window: imports older than 10 minutes don't count, and those older than a day are purged.
select tests.clear_authentication();
update private.url_import_log set requested_at = now() - interval '11 minutes'
  where user_id = 'a0000000-0000-4000-8000-00000000000a';
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select lives_ok($$ select public.register_url_import() $$, 'imports older than 10 minutes do not count');

select tests.clear_authentication();
update private.url_import_log set requested_at = now() - interval '2 days'
  where user_id = 'a0000000-0000-4000-8000-00000000000a';
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select public.register_url_import();
select tests.clear_authentication();
select is(
  (select count(*)::int from private.url_import_log where user_id = 'a0000000-0000-4000-8000-00000000000a'),
  1,
  'imports older than a day are purged'
);
select is(
  (select count(*)::int from private.url_import_log where user_id = 'b0000000-0000-4000-8000-00000000000b'),
  1,
  'purging leaves other users alone'
);

select tests.as_anon();
select throws_ok($$ select public.register_url_import() $$, '42501', null, 'anonymous callers cannot import');

select * from finish();
rollback;
