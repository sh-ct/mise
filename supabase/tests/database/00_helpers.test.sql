-- Runs first (files run alphabetically) and commits helper functions for the other test files.
begin;
create extension if not exists pgtap with schema extensions;


create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

create or replace function tests.create_user(p_id uuid, p_email text)
returns void
language sql
security definer
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

-- A small valid RecipeDraft (packages/core shape) with fixed ids so tests can refer to them.
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
    'sourceType', 'manual',
    'unitSystem', 'metric',
    'tags', jsonb_build_array('Soup', 'soup ', 'Winter'),
    'ingredientSections', jsonb_build_array(jsonb_build_object(
      'id', '10000000-0000-4000-8000-000000000001',
      'ingredients', jsonb_build_array(
        jsonb_build_object('id', '20000000-0000-4000-8000-000000000001', 'qtyMin', 1, 'unit', 'kg', 'item', 'onions', 'prepNote', 'sliced', 'optional', false, 'rawText', '1kg onions, sliced'),
        jsonb_build_object('id', '20000000-0000-4000-8000-000000000002', 'qtyMin', 50, 'unit', 'g', 'item', 'butter', 'optional', false, 'rawText', '50g butter'),
        jsonb_build_object('id', '20000000-0000-4000-8000-000000000003', 'qtyMin', 1, 'unit', 'l', 'item', 'beef stock', 'optional', false, 'rawText', '1l beef stock')
      )
    )),
    'stepSections', jsonb_build_array(jsonb_build_object(
      'id', '10000000-0000-4000-8000-000000000002',
      'steps', jsonb_build_array(
        jsonb_build_object('id', '30000000-0000-4000-8000-000000000001', 'text', 'Melt the butter and cook the onions for 40 minutes.', 'glossarySuppress', '[]'::jsonb,
          'ingredientRefs', jsonb_build_array(
            jsonb_build_object('ingredientId', '20000000-0000-4000-8000-000000000002', 'amountFraction', 1),
            jsonb_build_object('ingredientId', '20000000-0000-4000-8000-000000000001', 'amountFraction', 1))),
        jsonb_build_object('id', '30000000-0000-4000-8000-000000000002', 'text', 'Add the stock and simmer.', 'glossarySuppress', '["simmer"]'::jsonb,
          'ingredientRefs', jsonb_build_array(
            jsonb_build_object('ingredientId', '20000000-0000-4000-8000-000000000003', 'amountFraction', 0.5)))
      )
    ))
  );
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select ok(true, 'test helpers installed');
select * from finish();
commit;
