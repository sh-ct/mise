-- save_recipe(draft): create or replace a whole recipe atomically (ADR 0006).
--
-- `draft` is the RecipeDraft shape from packages/core (camelCase JSON). Client-generated UUIDs are kept,
-- so step→ingredient references resolve before anything is stored. Sections, ingredients, steps, links
-- and tags are replaced wholesale; per-user metadata, cook log, collections and source assets are kept.
--
-- SECURITY INVOKER: every statement runs under the caller's RLS policies, so a caller can only
-- create or overwrite their own recipes (an id owned by someone else fails the upsert's RLS check).
-- Returns the recipe id.

create function public.save_recipe(draft jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_id uuid := coalesce((draft ->> 'id')::uuid, gen_random_uuid());
begin
  if v_owner is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(draft -> 'ingredientSections') is distinct from 'array'
     or jsonb_typeof(draft -> 'stepSections') is distinct from 'array' then
    raise exception 'draft must have ingredientSections and stepSections arrays' using errcode = '22023';
  end if;

  insert into public.recipe as r (
    id, owner_id, title, description, servings, yield_text, prep_min, cook_min, total_min,
    source_type, source_url, source_attribution, unit_system, hero_image_path
  ) values (
    v_id,
    v_owner,
    draft ->> 'title',
    draft ->> 'description',
    (draft ->> 'servings')::numeric,
    draft ->> 'yieldText',
    (draft ->> 'prepMinutes')::integer,
    (draft ->> 'cookMinutes')::integer,
    (draft ->> 'totalMinutes')::integer,
    coalesce((draft ->> 'sourceType')::public.source_type, 'manual'),
    draft ->> 'sourceUrl',
    draft ->> 'sourceAttribution',
    coalesce((draft ->> 'unitSystem')::public.unit_system, 'mixed'),
    draft ->> 'heroImagePath'
  )
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    servings = excluded.servings,
    yield_text = excluded.yield_text,
    prep_min = excluded.prep_min,
    cook_min = excluded.cook_min,
    total_min = excluded.total_min,
    source_type = excluded.source_type,
    source_url = excluded.source_url,
    source_attribution = excluded.source_attribution,
    unit_system = excluded.unit_system,
    hero_image_path = excluded.hero_image_path;

  -- Replace structure. Ingredients, steps and links cascade from their sections.
  delete from public.recipe_section where recipe_id = v_id;

  insert into public.recipe_section (id, owner_id, recipe_id, kind, title, position)
  select (s ->> 'id')::uuid, v_owner, v_id, 'ingredients'::public.section_kind, nullif(btrim(s ->> 'title'), ''), (pos - 1)::integer
  from jsonb_array_elements(draft -> 'ingredientSections') with ordinality as x(s, pos)
  union all
  select (s ->> 'id')::uuid, v_owner, v_id, 'steps'::public.section_kind, nullif(btrim(s ->> 'title'), ''), (pos - 1)::integer
  from jsonb_array_elements(draft -> 'stepSections') with ordinality as x(s, pos);

  insert into public.ingredient (
    id, owner_id, recipe_id, section_id, position, qty_min, qty_max, unit, item, prep_note, note, optional, raw_text
  )
  select
    (i ->> 'id')::uuid, v_owner, v_id, (s ->> 'id')::uuid, (ipos - 1)::integer,
    (i ->> 'qtyMin')::numeric, (i ->> 'qtyMax')::numeric, i ->> 'unit', i ->> 'item',
    i ->> 'prepNote', i ->> 'note', coalesce((i ->> 'optional')::boolean, false), coalesce(i ->> 'rawText', i ->> 'item')
  from jsonb_array_elements(draft -> 'ingredientSections') as x(s)
  cross join lateral jsonb_array_elements(coalesce(s -> 'ingredients', '[]')) with ordinality as y(i, ipos);

  insert into public.step (id, owner_id, recipe_id, section_id, position, text, image_path, glossary_suppress)
  select
    (t ->> 'id')::uuid, v_owner, v_id, (s ->> 'id')::uuid, (tpos - 1)::integer,
    t ->> 'text', t ->> 'imagePath',
    coalesce(array(select jsonb_array_elements_text(t -> 'glossarySuppress')), '{}')
  from jsonb_array_elements(draft -> 'stepSections') as x(s)
  cross join lateral jsonb_array_elements(coalesce(s -> 'steps', '[]')) with ordinality as y(t, tpos);

  -- The composite foreign keys reject references to ingredients outside this recipe.
  insert into public.step_ingredient (owner_id, recipe_id, step_id, ingredient_id, amount_fraction)
  select
    v_owner, v_id, (t ->> 'id')::uuid, (ref ->> 'ingredientId')::uuid, coalesce((ref ->> 'amountFraction')::numeric, 1)
  from jsonb_array_elements(draft -> 'stepSections') as x(s)
  cross join lateral jsonb_array_elements(coalesce(s -> 'steps', '[]')) as y(t)
  cross join lateral jsonb_array_elements(coalesce(t -> 'ingredientRefs', '[]')) as z(ref);

  -- Tags by name: reuse the user's existing tag (case-insensitive) or create it.
  delete from public.recipe_tag where recipe_id = v_id;
  if jsonb_typeof(draft -> 'tags') = 'array' then
    insert into public.tag (owner_id, name)
    select distinct on (lower(btrim(name))) v_owner, btrim(name)
    from jsonb_array_elements_text(draft -> 'tags') as n(name)
    where btrim(name) <> ''
    on conflict (owner_id, lower(name)) do nothing;

    insert into public.recipe_tag (owner_id, recipe_id, tag_id)
    select distinct v_owner, v_id, t.id
    from jsonb_array_elements_text(draft -> 'tags') as n(name)
    join public.tag t on t.owner_id = v_owner and lower(t.name) = lower(btrim(n.name));
  end if;

  -- Re-index now that ingredients and tags exist.
  update public.recipe set search = null where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.save_recipe(jsonb) from public, anon;
grant execute on function public.save_recipe(jsonb) to authenticated;
