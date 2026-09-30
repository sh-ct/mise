-- Runs first (files run alphabetically) and commits helper functions for the other test files.
-- Local test database only: never run `supabase test db --linked`.
begin;
create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Called as postgres only; deliberately not granted to anon/authenticated.
create or replace function tests.create_user(p_id uuid, p_email text)
returns void
language sql
set search_path = ''
as $$
  insert into auth.users (id, email, aud, role, instance_id)
  values (p_id, p_email, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
$$;

create or replace function tests.authenticate_as(p_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create or replace function tests.as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end;
$$;

create or replace function tests.clear_authentication()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', null, true);
  execute 'reset role';
end;
$$;

-- Deterministic child id, unique per recipe, so several sample drafts can coexist in one test.
create or replace function tests.id(p_recipe_id uuid, p_label text)
returns uuid
language sql
immutable
as $$
  select md5(p_recipe_id::text || p_label)::uuid;
$$;

-- A small valid RecipeDraft (packages/core shape). Refer to children with tests.id(recipe_id, label).
create or replace function tests.sample_draft(p_recipe_id uuid)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', p_recipe_id,
    'title', 'Onion Soup',
    'description', 'Slow and sweet.',
    'servings', 4,
    'yieldText', '4 bowls',
    'prepMinutes', 15,
    'cookMinutes', 60,
    'sourceType', 'manual',
    'sourceUrl', 'https://example.test/soup',
    'unitSystem', 'metric',
    'tags', jsonb_build_array('Soup', 'soup ', 'Winter'),
    'ingredientSections', jsonb_build_array(
      jsonb_build_object(
        'id', tests.id(p_recipe_id, 'is1'),
        'ingredients', jsonb_build_array(
          jsonb_build_object('id', tests.id(p_recipe_id, 'onions'), 'qtyMin', 1, 'unit', 'kg', 'item', 'onions',
            'prepNote', 'sliced', 'optional', false, 'rawText', '1kg onions, sliced'),
          jsonb_build_object('id', tests.id(p_recipe_id, 'butter'), 'qtyMin', 50, 'unit', 'g', 'item', 'butter',
            'optional', false, 'rawText', '50g butter')
        )
      ),
      jsonb_build_object(
        'id', tests.id(p_recipe_id, 'is2'),
        'title', 'To serve',
        'ingredients', jsonb_build_array(
          jsonb_build_object('id', tests.id(p_recipe_id, 'stock'), 'qtyMin', 1, 'qtyMax', 1.5, 'unit', 'l',
            'item', 'beef stock', 'note', 'or vegetable', 'optional', true, 'rawText', '1-1.5l beef stock (or vegetable)')
        )
      )
    ),
    'stepSections', jsonb_build_array(jsonb_build_object(
      'id', tests.id(p_recipe_id, 'ss1'),
      'steps', jsonb_build_array(
        jsonb_build_object('id', tests.id(p_recipe_id, 'step1'), 'text', 'Melt the butter and cook the onions for 40 minutes.',
          'glossarySuppress', '[]'::jsonb,
          'ingredientRefs', jsonb_build_array(
            jsonb_build_object('ingredientId', tests.id(p_recipe_id, 'butter'), 'amountFraction', 1),
            jsonb_build_object('ingredientId', tests.id(p_recipe_id, 'onions'), 'amountFraction', 1))),
        jsonb_build_object('id', tests.id(p_recipe_id, 'step2'), 'text', 'Add the stock and simmer.',
          'imagePath', null, 'glossarySuppress', '["simmer"]'::jsonb,
          'ingredientRefs', jsonb_build_array(
            jsonb_build_object('ingredientId', tests.id(p_recipe_id, 'stock'), 'amountFraction', 0.5)))
      )
    ))
  );
$$;

grant execute on function
  tests.authenticate_as(uuid), tests.as_anon(), tests.clear_authentication(), tests.id(uuid, text), tests.sample_draft(uuid)
to anon, authenticated;

select plan(1);
select ok(true, 'test helpers installed');
select * from finish();
commit;
