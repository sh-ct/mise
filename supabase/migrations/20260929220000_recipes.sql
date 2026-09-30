-- Recipes, their sections/ingredients/steps, organisation (tags, collections) and per-user metadata.
-- See docs/ARCHITECTURE.md#data-model.
--
-- Every user-owned row carries owner_id and is protected by RLS (owner_id = auth.uid()).
-- Child rows repeat owner_id and reference the parent by (id, owner_id), so a row can never belong to
-- a different user than its recipe, and RLS stays a cheap column comparison.
--
-- Length and size limits mirror LIMITS in packages/core/src/schema/recipe.ts; keep them in sync.

create extension if not exists pg_trgm with schema extensions;

-- Internal helpers live outside `public`, which PostgREST exposes as the API.
create schema private;
grant usage on schema private to authenticated;

create type public.source_type as enum ('manual', 'url', 'text', 'scan', 'ai');
create type public.unit_system as enum ('metric', 'us', 'mixed');
create type public.visibility as enum ('private', 'unlisted', 'public');
create type public.section_kind as enum ('ingredients', 'steps');
create type public.tag_kind as enum ('cuisine', 'course', 'diet', 'custom');
create type public.asset_kind as enum ('scan', 'photo');

-- Storage object keys must sit in the owner's folder ({owner_id}/…), so a recipe can't point at
-- someone else's files once recipes are shared.
create function private.is_owner_path(path text, owner uuid)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select path is null
    or (length(path) <= 500 and path like owner::text || '/%' and position('..' in path) = 0);
$$;

-- ---------------------------------------------------------------------------------------------
-- recipe
-- ---------------------------------------------------------------------------------------------

create table public.recipe (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (title ~ '\S' and length(title) <= 200),
  description text check (length(description) <= 5000),
  servings numeric check (servings > 0 and servings <= 1000),
  yield_text text check (length(yield_text) <= 100),
  prep_minutes integer check (prep_minutes between 0 and 10080),
  cook_minutes integer check (cook_minutes between 0 and 10080),
  total_minutes integer check (total_minutes between 0 and 10080),
  source_type public.source_type not null default 'manual',
  source_url text check (source_url ~* '^https?://' and length(source_url) <= 2000),
  source_attribution text check (length(source_attribution) <= 200),
  unit_system public.unit_system not null default 'mixed',
  hero_image_path text check (private.is_owner_path(hero_image_path, owner_id)),
  -- Only 'private' until sharing ships (Phase 6); enforced here so nothing leaks early.
  visibility public.visibility not null default 'private' check (visibility = 'private'),
  search tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create index recipe_owner_updated_idx on public.recipe (owner_id, updated_at desc);
create index recipe_search_idx on public.recipe using gin (search);
create index recipe_title_trgm_idx on public.recipe using gin (title extensions.gin_trgm_ops);

create table public.recipe_section (
  id uuid primary key,
  owner_id uuid not null default auth.uid(),
  recipe_id uuid not null,
  kind public.section_kind not null,
  title text check (length(title) <= 100),
  position integer not null check (position >= 0),
  foreign key (recipe_id, owner_id) references public.recipe (id, owner_id) on delete cascade,
  unique (id, recipe_id, kind),
  unique (recipe_id, kind, position)
);

create table public.ingredient (
  id uuid primary key,
  owner_id uuid not null default auth.uid(),
  recipe_id uuid not null,
  section_id uuid not null,
  -- Always 'ingredients'; part of the FK so an ingredient can't sit in a steps section.
  section_kind public.section_kind not null default 'ingredients' check (section_kind = 'ingredients'),
  position integer not null check (position >= 0),
  qty_min numeric check (qty_min > 0 and qty_min <= 100000),
  qty_max numeric check (qty_max > 0 and qty_max <= 100000),
  unit text check (length(unit) <= 20),
  item text not null check (item ~ '\S' and length(item) <= 200),
  prep_note text check (length(prep_note) <= 200),
  note text check (length(note) <= 200),
  optional boolean not null default false,
  raw_text text not null check (length(raw_text) <= 500),
  foreign key (recipe_id, owner_id) references public.recipe (id, owner_id) on delete cascade,
  foreign key (section_id, recipe_id, section_kind) references public.recipe_section (id, recipe_id, kind) on delete cascade,
  unique (id, recipe_id),
  unique (section_id, position),
  check (qty_max is null or (qty_min is not null and qty_max >= qty_min))
);

create index ingredient_recipe_idx on public.ingredient (recipe_id);

create table public.step (
  id uuid primary key,
  owner_id uuid not null default auth.uid(),
  recipe_id uuid not null,
  section_id uuid not null,
  section_kind public.section_kind not null default 'steps' check (section_kind = 'steps'),
  position integer not null check (position >= 0),
  -- Plain prose: timers and glossary terms are detected at render time (ADR 0005).
  text text not null check (text ~ '\S' and length(text) <= 5000),
  image_path text check (private.is_owner_path(image_path, owner_id)),
  glossary_suppress text[] not null default '{}' check (cardinality(glossary_suppress) <= 50),
  foreign key (recipe_id, owner_id) references public.recipe (id, owner_id) on delete cascade,
  foreign key (section_id, recipe_id, section_kind) references public.recipe_section (id, recipe_id, kind) on delete cascade,
  unique (id, recipe_id),
  unique (section_id, position)
);

create index step_recipe_idx on public.step (recipe_id);

create table public.step_ingredient (
  owner_id uuid not null default auth.uid(),
  recipe_id uuid not null,
  step_id uuid not null,
  ingredient_id uuid not null,
  amount_fraction numeric not null default 1 check (amount_fraction > 0 and amount_fraction <= 1),
  primary key (step_id, ingredient_id),
  foreign key (recipe_id, owner_id) references public.recipe (id, owner_id) on delete cascade,
  -- Both ends must belong to the same recipe.
  foreign key (step_id, recipe_id) references public.step (id, recipe_id) on delete cascade,
  foreign key (ingredient_id, recipe_id) references public.ingredient (id, recipe_id) on delete cascade
);

create index step_ingredient_ingredient_idx on public.step_ingredient (ingredient_id);
create index step_ingredient_recipe_idx on public.step_ingredient (recipe_id);

create table public.source_asset (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  recipe_id uuid not null,
  kind public.asset_kind not null,
  storage_path text not null check (private.is_owner_path(storage_path, owner_id)),
  ocr_text text check (length(ocr_text) <= 50000),
  created_at timestamptz not null default now(),
  foreign key (recipe_id, owner_id) references public.recipe (id, owner_id) on delete cascade
);

create index source_asset_recipe_idx on public.source_asset (recipe_id);

-- ---------------------------------------------------------------------------------------------
-- organisation
-- ---------------------------------------------------------------------------------------------

create table public.tag (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind public.tag_kind not null default 'custom',
  name text not null check (name ~ '\S' and length(name) <= 40),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create unique index tag_owner_name_idx on public.tag (owner_id, lower(name));

-- Embed tags through this table: recipe?select=*,recipe_tag(tag(name)). The composite owner FKs keep
-- PostgREST from treating it as a plain many-to-many.
create table public.recipe_tag (
  owner_id uuid not null default auth.uid(),
  recipe_id uuid not null,
  tag_id uuid not null,
  primary key (recipe_id, tag_id),
  foreign key (recipe_id, owner_id) references public.recipe (id, owner_id) on delete cascade,
  foreign key (tag_id, owner_id) references public.tag (id, owner_id) on delete cascade
);

create index recipe_tag_tag_idx on public.recipe_tag (tag_id);

create table public.collection (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (name ~ '\S' and length(name) <= 100),
  description text check (length(description) <= 1000),
  cover_image_path text check (private.is_owner_path(cover_image_path, owner_id)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create index collection_owner_idx on public.collection (owner_id);

create table public.collection_recipe (
  owner_id uuid not null default auth.uid(),
  collection_id uuid not null,
  recipe_id uuid not null,
  position integer not null default 0,
  added_at timestamptz not null default now(),
  primary key (collection_id, recipe_id),
  foreign key (collection_id, owner_id) references public.collection (id, owner_id) on delete cascade,
  foreign key (recipe_id, owner_id) references public.recipe (id, owner_id) on delete cascade
);

create index collection_recipe_recipe_idx on public.collection_recipe (recipe_id);

-- Per-user metadata, keyed by user rather than recipe owner so it keeps working once recipes are shared.
create table public.user_recipe_meta (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipe (id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  favourite boolean not null default false,
  notes text check (length(notes) <= 5000),
  updated_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create index user_recipe_meta_recipe_idx on public.user_recipe_meta (recipe_id);

create table public.cook_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipe (id) on delete cascade,
  cooked_at timestamptz not null default now(),
  notes text check (length(notes) <= 2000)
);

create index cook_log_user_recipe_idx on public.cook_log (user_id, recipe_id, cooked_at desc);
create index cook_log_recipe_idx on public.cook_log (recipe_id);

-- Global, curated glossary (ADR 0005). Readable by everyone; written only by migrations/service role.
create table public.glossary_term (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  term text not null check (term ~ '\S'),
  aliases text[] not null default '{}',
  definition text not null,
  -- { "requireNear"?: string[], "excludeNear"?: string[], "window"?: number } — core GlossaryMatchRules
  match_rules jsonb not null default '{}' check (jsonb_typeof(match_rules) = 'object'),
  plain_phrasing text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- search & timestamps
-- ---------------------------------------------------------------------------------------------

-- Title (A), description + ingredient items (B), tag names (C). 'english' gives stemming, so
-- "onions" finds "onion".
create function private.recipe_search_vector(p_recipe_id uuid, p_title text, p_description text)
returns tsvector
language sql
stable
set search_path = ''
as $$
  select
    setweight(to_tsvector('english', coalesce(p_title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(p_description, '')), 'B')
    || setweight(to_tsvector('english', coalesce(
         (select string_agg(i.item, ' ') from public.ingredient i where i.recipe_id = p_recipe_id), '')), 'B')
    || setweight(to_tsvector('english', coalesce(
         (select string_agg(t.name, ' ') from public.recipe_tag rt join public.tag t on t.id = rt.tag_id
          where rt.recipe_id = p_recipe_id), '')), 'C');
$$;

-- Always recomputes `search`. Bumps updated_at for real edits, but not for a search refresh
-- (search set to null with no other change), so tagging doesn't reorder "recently updated".
-- created_at and updated_at can't be set by clients.
create function private.recipe_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.updated_at := now();
  else
    new.created_at := old.created_at;
    if new.search is null
       and (new.title, new.description, new.servings, new.yield_text, new.prep_minutes, new.cook_minutes,
            new.total_minutes, new.source_type, new.source_url, new.source_attribution, new.unit_system,
            new.hero_image_path, new.visibility)
       is not distinct from
           (old.title, old.description, old.servings, old.yield_text, old.prep_minutes, old.cook_minutes,
            old.total_minutes, old.source_type, old.source_url, old.source_attribution, old.unit_system,
            old.hero_image_path, old.visibility) then
      new.updated_at := old.updated_at;
    else
      new.updated_at := now();
    end if;
  end if;
  new.search := private.recipe_search_vector(new.id, new.title, new.description);
  return new;
end;
$$;

create trigger recipe_before_write
before insert or update on public.recipe
for each row execute function private.recipe_before_write();

-- Re-index recipes whose ingredients or tags changed. Statement-level, so a save that inserts 30
-- ingredients re-indexes once. All transition tables are named `changed`.
create function private.refresh_recipe_search()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_table_name = 'tag' then
    update public.recipe set search = null
    where id in (select rt.recipe_id from public.recipe_tag rt join changed c on c.id = rt.tag_id);
  else
    update public.recipe set search = null where id in (select c.recipe_id from changed c);
  end if;
  return null;
end;
$$;

create trigger ingredient_inserted_refresh_search after insert on public.ingredient
referencing new table as changed for each statement execute function private.refresh_recipe_search();
create trigger ingredient_updated_refresh_search after update on public.ingredient
referencing new table as changed for each statement execute function private.refresh_recipe_search();
create trigger ingredient_deleted_refresh_search after delete on public.ingredient
referencing old table as changed for each statement execute function private.refresh_recipe_search();
create trigger recipe_tag_inserted_refresh_search after insert on public.recipe_tag
referencing new table as changed for each statement execute function private.refresh_recipe_search();
create trigger recipe_tag_deleted_refresh_search after delete on public.recipe_tag
referencing old table as changed for each statement execute function private.refresh_recipe_search();
create trigger tag_updated_refresh_search after update on public.tag
referencing new table as changed for each statement execute function private.refresh_recipe_search();

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger collection_set_updated_at before update on public.collection
for each row execute function private.set_updated_at();
create trigger user_recipe_meta_set_updated_at before update on public.user_recipe_meta
for each row execute function private.set_updated_at();
create trigger glossary_term_set_updated_at before update on public.glossary_term
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- row level security & privileges
-- ---------------------------------------------------------------------------------------------

-- Owner-only access for every owner_id table. `(select auth.uid())` is evaluated once per statement.
do $$
declare
  t text;
begin
  foreach t in array array[
    'recipe', 'recipe_section', 'ingredient', 'step', 'step_ingredient', 'source_asset',
    'tag', 'recipe_tag', 'collection', 'collection_recipe'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (owner_id = (select auth.uid()))
         with check (owner_id = (select auth.uid()))',
      t || '_owner', t);
  end loop;
end;
$$;

-- Per-user rows: your own, and only for recipes you can see.
alter table public.user_recipe_meta enable row level security;
create policy user_recipe_meta_owner on public.user_recipe_meta for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipe r where r.id = user_recipe_meta.recipe_id)
  );

alter table public.cook_log enable row level security;
create policy cook_log_owner on public.cook_log for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipe r where r.id = cook_log.recipe_id)
  );

alter table public.glossary_term enable row level security;
create policy glossary_term_read on public.glossary_term for select to anon, authenticated using (true);

-- Supabase's default grants give anon and authenticated every privilege on public tables, with RLS as
-- the gate. Narrow them: anon only reads the glossary; nobody but the owner role can TRUNCATE (which
-- bypasses RLS), and tables created later start closed to anon.
revoke all on all tables in schema public from anon;
grant select on public.glossary_term to anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
revoke insert, update, delete on public.glossary_term from authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;

revoke all on all functions in schema private from public;
grant execute on function private.recipe_search_vector(uuid, text, text) to authenticated;
grant execute on function private.is_owner_path(text, uuid) to authenticated;
