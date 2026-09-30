-- register_url_import: per-user rate limit for the import-url edge function.
begin;
select plan(5);

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

select tests.as_anon();
select throws_ok($$ select public.register_url_import() $$, '42501', null, 'anonymous callers cannot import');

select * from finish();
rollback;
