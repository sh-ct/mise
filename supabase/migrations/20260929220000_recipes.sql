-- Recipes, their sections/ingredients/steps, organisation (tags, collections) and per-user metadata.
-- See docs/ARCHITECTURE.md#data-model.
--
-- Every user-owned row carries owner_id and is protected by RLS (owner_id = auth.uid()).
-- Child rows repeat owner_id and reference the parent by (id, owner_id), so a row can never belong to
-- a different user than its recipe, and RLS stays a cheap column comparison.

create extension if not exists pg_trgm with schema extensions;

create type public.source_type as enum ('manual', 'url', 'text', 'scan', 'ai');
create type public.unit_system as enum ('metric', 'us', 'mixed');
create type public.visibility as enum ('private', 'unlisted', 'public');
create type public.section_kind as enum ('ingredients', 'steps');
create type public.tag_kind as enum ('cuisine', 'course', 'diet', 'custom');
create type public.asset_kind as enum ('scan', 'photo');

-- ---------------------------------------------------------------------------------------------
-- recipe
-- ---------------------------------------------------------------------------------------------

create table public.recipe (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text check (length(description) <= 5000),
  servings numeric check (servings > 0),
  yield_text text check (length(yield_text) <= 100),
  prep_min integer check (prep_min >= 0),
  cook_min integer check (cook_min >= 0),
  total_min integer check (total_min >= 0),
  source_type public.source_type not null default 'manual',
  source_url text check (source_url ~* '^https?://'),
  source_attribution text check (length(source_attribution) <= 200),
  unit_system public.unit_system not null default 'mixed',
  hero_image_path text,
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
  qty_min numeric check (qty_min > 0),
  qty_max numeric check (qty_max > 0),
  unit text check (length(unit) <= 20),
  item text not null check (length(btrim(item)) between 1 and 200),
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
  text text not null check (length(btrim(text)) between 1 and 5000),
  image_path text,
  glossary_suppress text[] not null default '{}',
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

create table public.source_asset (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  recipe_id uuid not null,
  kind public.asset_kind not null,
  storage_path text not null,
  ocr_text text,
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
  name text not null check (length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

create unique index tag_owner_name_idx on public.tag (owner_id, lower(name));

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
  name text not null check (length(btrim(name)) between 1 and 100),
  description text check (length(description) <= 1000),
  cover_image_path text,
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

create table public.cook_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.recipe (id) on delete cascade,
  cooked_at timestamptz not null default now(),
  notes text check (length(notes) <= 2000)
);

create index cook_log_user_recipe_idx on public.cook_log (user_id, recipe_id, cooked_at desc);

-- Global, curated glossary (ADR 0005). Readable by everyone; written only by migrations/service role.
create table public.glossary_term (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  term text not null,
  aliases text[] not null default '{}',
  definition text not null,
  -- { "requireNear"?: string[], "excludeNear"?: string[], "window"?: number } — see core GlossaryMatchRules
  match_rules jsonb not null default '{}' check (jsonb_typeof(match_rules) = 'object'),
  plain_phrasing text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- search & timestamps
-- ---------------------------------------------------------------------------------------------

-- Title (A), description + ingredient items (B), tag names (C). 'english' gives stemming, so
-- "onions" finds "onion".
create function public.recipe_search_vector(p_recipe_id uuid, p_title text, p_description text)
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

create function public.recipe_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  new.search := public.recipe_search_vector(new.id, new.title, new.description);
  return new;
end;
$$;

create trigger recipe_before_write
before insert or update on public.recipe
for each row execute function public.recipe_before_write();

-- Tag changes outside save_recipe (e.g. tagging from the library) re-index the recipe.
create function public.recipe_tag_touch_recipe()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.recipe set search = null where id = coalesce(new.recipe_id, old.recipe_id);
  return null;
end;
$$;

create trigger recipe_tag_touch_recipe
after insert or delete on public.recipe_tag
for each row execute function public.recipe_tag_touch_recipe();

create function public.set_updated_at()
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
for each row execute function public.set_updated_at();
create trigger user_recipe_meta_set_updated_at before update on public.user_recipe_meta
for each row execute function public.set_updated_at();
create trigger glossary_term_set_updated_at before update on public.glossary_term
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------------------------

alter table public.recipe enable row level security;
alter table public.recipe_section enable row level security;
alter table public.ingredient enable row level security;
alter table public.step enable row level security;
alter table public.step_ingredient enable row level security;
alter table public.source_asset enable row level security;
alter table public.tag enable row level security;
alter table public.recipe_tag enable row level security;
alter table public.collection enable row level security;
alter table public.collection_recipe enable row level security;
alter table public.user_recipe_meta enable row level security;
alter table public.cook_log enable row level security;
alter table public.glossary_term enable row level security;

-- Owner-only access for every owner_id table. `(select auth.uid())` is evaluated once per statement.
do $$
declare
  t text;
begin
  foreach t in array array[
    'recipe', 'recipe_section', 'ingredient', 'step', 'step_ingredient', 'source_asset',
    'tag', 'recipe_tag', 'collection', 'collection_recipe'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (owner_id = (select auth.uid()))
         with check (owner_id = (select auth.uid()))',
      t || '_owner_all', t);
  end loop;
end;
$$;

-- Per-user rows: your own, and only for recipes you can see.
create policy user_recipe_meta_own on public.user_recipe_meta for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipe r where r.id = recipe_id)
  );

create policy cook_log_own on public.cook_log for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipe r where r.id = recipe_id)
  );

create policy glossary_term_read on public.glossary_term for select to anon, authenticated using (true);

-- Default grants in Supabase give anon/authenticated full table privileges; RLS is the gate.
-- Tighten anyway: anon only needs the glossary.
revoke all on
  public.recipe, public.recipe_section, public.ingredient, public.step, public.step_ingredient,
  public.source_asset, public.tag, public.recipe_tag, public.collection, public.collection_recipe,
  public.user_recipe_meta, public.cook_log
from anon;
revoke insert, update, delete on public.glossary_term from anon, authenticated;
