-- Row level security and privileges: users only ever see or change their own data.
begin;
select plan(17);

select tests.create_user('a0000000-0000-4000-8000-00000000000a', 'alice@example.test');
select tests.create_user('b0000000-0000-4000-8000-00000000000b', 'bob@example.test');

select is(
  (select count(*) from pg_tables where schemaname = 'public' and not rowsecurity),
  0::bigint,
  'every public table has RLS enabled'
);
select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public' and table_name <> 'glossary_term'
  ),
  'anon has no privileges on user tables'
);
select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where grantee in ('anon', 'authenticated') and table_schema = 'public' and privilege_type = 'TRUNCATE'
  ),
  'nobody but the owner can TRUNCATE (it bypasses RLS)'
);

-- Alice creates data in every user table
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
select lives_ok(
  $$ select public.save_recipe(tests.sample_draft('c0000000-0000-4000-8000-00000000000c')) $$,
  'alice can save a recipe'
);
insert into public.source_asset (recipe_id, kind, storage_path)
  values ('c0000000-0000-4000-8000-00000000000c', 'scan', 'a0000000-0000-4000-8000-00000000000a/c/scan.jpg');
insert into public.collection (id, name) values ('d0000000-0000-4000-8000-00000000000d', 'Winter');
insert into public.collection_recipe (collection_id, recipe_id)
  values ('d0000000-0000-4000-8000-00000000000d', 'c0000000-0000-4000-8000-00000000000c');
insert into public.user_recipe_meta (recipe_id, favourite) values ('c0000000-0000-4000-8000-00000000000c', true);
insert into public.cook_log (recipe_id) values ('c0000000-0000-4000-8000-00000000000c');
insert into storage.objects (bucket_id, name)
  values ('recipe-images', 'a0000000-0000-4000-8000-00000000000a/c/hero-400.webp');

-- Bob sees nothing of Alice's, in any table
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select results_eq(
  $$ select 'recipe', count(*) from public.recipe
     union all select 'recipe_section', count(*) from public.recipe_section
     union all select 'ingredient', count(*) from public.ingredient
     union all select 'step', count(*) from public.step
     union all select 'step_ingredient', count(*) from public.step_ingredient
     union all select 'source_asset', count(*) from public.source_asset
     union all select 'tag', count(*) from public.tag
     union all select 'recipe_tag', count(*) from public.recipe_tag
     union all select 'collection', count(*) from public.collection
     union all select 'collection_recipe', count(*) from public.collection_recipe
     union all select 'user_recipe_meta', count(*) from public.user_recipe_meta
     union all select 'cook_log', count(*) from public.cook_log
     union all select 'storage', count(*) from storage.objects $$,
  $$ values ('recipe', 0::bigint), ('recipe_section', 0), ('ingredient', 0), ('step', 0), ('step_ingredient', 0),
            ('source_asset', 0), ('tag', 0), ('recipe_tag', 0), ('collection', 0), ('collection_recipe', 0),
            ('user_recipe_meta', 0), ('cook_log', 0), ('storage', 0) $$,
  'bob sees none of alice''s rows in any table'
);

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
     values (gen_random_uuid(), 'c0000000-0000-4000-8000-00000000000c',
             tests.id('c0000000-0000-4000-8000-00000000000c', 'is1'), 9, 'x', 'x') $$,
  '23503', null,
  'bob cannot add an ingredient to alice''s recipe (owner mismatch)'
);
select throws_ok(
  $$ insert into public.ingredient (id, owner_id, recipe_id, section_id, position, item, raw_text)
     values (gen_random_uuid(), 'a0000000-0000-4000-8000-00000000000a', 'c0000000-0000-4000-8000-00000000000c',
             tests.id('c0000000-0000-4000-8000-00000000000c', 'is1'), 9, 'x', 'x') $$,
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
insert into public.collection (id, name) values ('e0000000-0000-4000-8000-00000000000e', 'Bob''s');
select throws_ok(
  $$ insert into public.collection_recipe (collection_id, recipe_id)
     values ('e0000000-0000-4000-8000-00000000000e', 'c0000000-0000-4000-8000-00000000000c') $$,
  '23503', null,
  'bob cannot add alice''s recipe to his own collection'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('recipe-images', 'a0000000-0000-4000-8000-00000000000a/c/x.webp') $$,
  '42501', null,
  'bob cannot upload into alice''s storage folder'
);
select throws_ok(
  $$ select public.save_recipe(jsonb_set(tests.sample_draft('f0000000-0000-4000-8000-00000000000f'),
       '{stepSections,0,steps,0,imagePath}', '"a0000000-0000-4000-8000-00000000000a/c/hero-400.webp"')) $$,
  '23514', null,
  'bob cannot point a step image at alice''s files'
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
