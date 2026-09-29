-- Row level security: users only ever see or change their own data.
begin;
select plan(20);

select tests.create_user('a0000000-0000-4000-8000-00000000000a', 'alice@example.test');
select tests.create_user('b0000000-0000-4000-8000-00000000000b', 'bob@example.test');

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'every public table has RLS enabled'
);

-- Alice saves a recipe
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select public.save_recipe(tests.sample_draft('c0000000-0000-4000-8000-00000000000c')) $$,
  'alice can save a recipe'
);
insert into public.user_recipe_meta (recipe_id, favourite) values ('c0000000-0000-4000-8000-00000000000c', true);
insert into public.collection (id, name) values ('d0000000-0000-4000-8000-00000000000d', 'Winter');
select is((select count(*) from public.recipe), 1::bigint, 'alice sees her recipe');

-- Bob sees nothing of Alice's
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select is((select count(*) from public.recipe), 0::bigint, 'bob cannot see alice''s recipe');
select is((select count(*) from public.ingredient), 0::bigint, 'bob cannot see alice''s ingredients');
select is((select count(*) from public.step), 0::bigint, 'bob cannot see alice''s steps');
select is((select count(*) from public.step_ingredient), 0::bigint, 'bob cannot see alice''s step links');
select is((select count(*) from public.tag), 0::bigint, 'bob cannot see alice''s tags');
select is((select count(*) from public.collection), 0::bigint, 'bob cannot see alice''s collections');
select is((select count(*) from public.user_recipe_meta), 0::bigint, 'bob cannot see alice''s recipe metadata');

select is_empty(
  $$ update public.recipe set title = 'Hacked' where id = 'c0000000-0000-4000-8000-00000000000c' returning 1 $$,
  'bob cannot update alice''s recipe'
);
select is_empty(
  $$ delete from public.recipe where id = 'c0000000-0000-4000-8000-00000000000c' returning 1 $$,
  'bob cannot delete alice''s recipe'
);
select throws_ok(
  $$ insert into public.ingredient (id, recipe_id, section_id, position, item, raw_text)
     values (gen_random_uuid(), 'c0000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-000000000001', 9, 'x', 'x') $$,
  '23503', null,
  'bob cannot add an ingredient to alice''s recipe (owner mismatch)'
);
select throws_ok(
  $$ insert into public.ingredient (id, owner_id, recipe_id, section_id, position, item, raw_text)
     values (gen_random_uuid(), 'a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-000000000001', 9, 'x', 'x') $$,
  '42501', null,
  'bob cannot insert rows claiming to be alice'
);
select throws_ok(
  $$ select public.save_recipe(tests.sample_draft('c0000000-0000-4000-8000-00000000000c')) $$,
  '42501', null,
  'bob cannot overwrite alice''s recipe via save_recipe'
);
select throws_ok(
  $$ insert into public.user_recipe_meta (recipe_id, rating) values ('c0000000-0000-4000-8000-00000000000c', 1) $$,
  '42501', null,
  'bob cannot attach metadata to a recipe he cannot see'
);
select throws_ok(
  $$ insert into public.collection_recipe (collection_id, recipe_id)
     values ('d0000000-0000-4000-8000-00000000000d', 'c0000000-0000-4000-8000-00000000000c') $$,
  '23503', null,
  'bob cannot add alice''s recipe to alice''s collection'
);

-- Glossary is global read-only content
select tests.clear_authentication();
insert into public.glossary_term (slug, term, definition) values ('test-term', 'test term', 'For tests.');

select tests.as_anon();
select is((select count(*) from public.glossary_term where slug = 'test-term'), 1::bigint, 'anon can read the glossary');
select throws_ok($$ select count(*) from public.recipe $$, '42501', null, 'anon has no access to recipes');

select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select throws_ok(
  $$ insert into public.glossary_term (slug, term, definition) values ('x', 'x', 'x') $$,
  '42501', null,
  'users cannot write the glossary'
);

select * from finish();
rollback;
