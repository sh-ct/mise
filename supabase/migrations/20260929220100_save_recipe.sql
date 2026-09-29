-- save_recipe(draft): create or replace a whole recipe atomically (ADR 0006).
--
-- `draft` is the RecipeDraft shape from packages/core (camelCase JSON). All ids are client-generated,
-- so step→ingredient references resolve before anything is stored and re-sending a draft is an
-- idempotent overwrite. Sections, ingredients, steps, links and tags are replaced wholesale, so nothing
-- else may hold foreign keys to ingredient or step ids; per-user metadata, the cook log, collections
-- and source assets are kept. `heroImageUrl` is ignored: the client uploads the image and sends
-- `heroImagePath`.
--
-- SECURITY INVOKER: every statement runs under the caller's RLS policies, so a caller can only
-- create or overwrite their own recipes (an id owned by someone else fails the upsert's RLS check).
-- Returns the recipe id.

-- A JSON array, or an empty one for null/missing/non-array values.
create function private.jsonb_array(value jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end;
$$;

grant execute on function private.jsonb_array(jsonb) to authenticated;

create function public.save_recipe(draft jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_id uuid := (draft ->> 'id')::uuid;
  v_ingredient_sections jsonb := private.jsonb_array(draft -> 'ingredientSections');
  v_step_sections jsonb := private.jsonb_array(draft -> 'stepSections');
  v_tags jsonb := private.jsonb_array(draft -> 'tags');
begin
  if v_owner is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if v_id is null then
    raise exception 'draft.id is required' using errcode = '22023';
  end if;

  -- Size limits (core LIMITS). Individual fields are bounded by column checks.
  if pg_column_size(draft) > 1024 * 1024 then
    raise exception 'draft too large' using errcode = '54000';
  end if;
  if jsonb_array_length(v_ingredient_sections) > 20
     or jsonb_array_length(v_step_sections) > 20
     or jsonb_array_length(v_tags) > 30
     or (select count(*) from jsonb_array_elements(v_ingredient_sections) s,
           jsonb_array_elements(private.jsonb_array(s -> 'ingredients'))) > 300
     or (select count(*) from jsonb_array_elements(v_step_sections) s,
           jsonb_array_elements(private.jsonb_array(s -> 'steps'))) > 200
     or exists (select 1 from jsonb_array_elements(v_step_sections) s,
           jsonb_array_elements(private.jsonb_array(s -> 'steps')) t
           where jsonb_array_length(private.jsonb_array(t -> 'ingredientRefs')) > 50) then
    raise exception 'draft exceeds size limits' using errcode = '54000';
  end if;

  insert into public.recipe (
    id, owner_id, title, description, servings, yield_text, prep_minutes, cook_minutes, total_minutes,
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
    prep_minutes = excluded.prep_minutes,
    cook_minutes = excluded.cook_minutes,
    total_minutes = excluded.total_minutes,
    source_type = excluded.source_type,
    source_url = excluded.source_url,
    source_attribution = excluded.source_attribution,
    unit_system = excluded.unit_system,
    hero_image_path = excluded.hero_image_path;

  -- Replace structure. Ingredients, steps and links cascade from their sections.
  delete from public.recipe_section where recipe_id = v_id;

  insert into public.recipe_section (id, owner_id, recipe_id, kind, title, position)
  select (s ->> 'id')::uuid, v_owner, v_id, 'ingredients'::public.section_kind, nullif(btrim(s ->> 'title'), ''), (pos - 1)::integer
  from jsonb_array_elements(v_ingredient_sections) with ordinality as x(s, pos)
  union all
  select (s ->> 'id')::uuid, v_owner, v_id, 'steps'::public.section_kind, nullif(btrim(s ->> 'title'), ''), (pos - 1)::integer
  from jsonb_array_elements(v_step_sections) with ordinality as x(s, pos);

  insert into public.ingredient (
    id, owner_id, recipe_id, section_id, position, qty_min, qty_max, unit, item, prep_note, note, optional, raw_text
  )
  select
    (i ->> 'id')::uuid, v_owner, v_id, (s ->> 'id')::uuid, (ipos - 1)::integer,
    (i ->> 'qtyMin')::numeric, (i ->> 'qtyMax')::numeric, i ->> 'unit', i ->> 'item',
    i ->> 'prepNote', i ->> 'note', coalesce((i ->> 'optional')::boolean, false), i ->> 'rawText'
  from jsonb_array_elements(v_ingredient_sections) as x(s)
  cross join lateral jsonb_array_elements(private.jsonb_array(s -> 'ingredients')) with ordinality as y(i, ipos);

  insert into public.step (id, owner_id, recipe_id, section_id, position, text, image_path, glossary_suppress)
  select
    (t ->> 'id')::uuid, v_owner, v_id, (s ->> 'id')::uuid, (tpos - 1)::integer,
    t ->> 'text', t ->> 'imagePath',
    array(select jsonb_array_elements_text(private.jsonb_array(t -> 'glossarySuppress')))
  from jsonb_array_elements(v_step_sections) as x(s)
  cross join lateral jsonb_array_elements(private.jsonb_array(s -> 'steps')) with ordinality as y(t, tpos);

  -- The composite foreign keys reject references to ingredients outside this recipe.
  insert into public.step_ingredient (owner_id, recipe_id, step_id, ingredient_id, amount_fraction)
  select
    v_owner, v_id, (t ->> 'id')::uuid, (ref ->> 'ingredientId')::uuid, coalesce((ref ->> 'amountFraction')::numeric, 1)
  from jsonb_array_elements(v_step_sections) as x(s)
  cross join lateral jsonb_array_elements(private.jsonb_array(s -> 'steps')) as y(t)
  cross join lateral jsonb_array_elements(private.jsonb_array(t -> 'ingredientRefs')) as z(ref);

  -- Tags by name: reuse the user's existing tag (case-insensitive) or create it.
  delete from public.recipe_tag where recipe_id = v_id;

  insert into public.tag (owner_id, name)
  select distinct on (lower(btrim(n.name))) v_owner, btrim(n.name)
  from jsonb_array_elements_text(v_tags) as n(name)
  where n.name ~ '\S'
  on conflict (owner_id, lower(name)) do nothing;

  insert into public.recipe_tag (owner_id, recipe_id, tag_id)
  select distinct v_owner, v_id, t.id
  from jsonb_array_elements_text(v_tags) as n(name)
  join public.tag t on t.owner_id = v_owner and lower(t.name) = lower(btrim(n.name));

  return v_id;
end;
$$;

revoke all on function public.save_recipe(jsonb) from public, anon;
grant execute on function public.save_recipe(jsonb) to authenticated;
