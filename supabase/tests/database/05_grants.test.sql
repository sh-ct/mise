-- Table grants for the API roles. Hosted projects don't expose public tables by default, so every table
-- the app uses must be granted in its migration; this catches one that isn't.
begin;
select plan(16);

select table_privs_are('public', t, 'authenticated', array['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  'authenticated can read and write ' || t)
from unnest(array[
  'recipe', 'recipe_section', 'ingredient', 'step', 'step_ingredient', 'source_asset', 'tag',
  'recipe_tag', 'collection', 'collection_recipe', 'user_recipe_meta', 'cook_log'
]) as t;

select table_privs_are('public', 'glossary_term', 'authenticated', array['SELECT'],
  'authenticated only reads the glossary');
select table_privs_are('public', 'glossary_term', 'anon', array['SELECT'], 'anon only reads the glossary');
select table_privs_are('public', 'recipe', 'anon', array[]::text[], 'anon has no access to user data');

select is(
  (select count(*)::int from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'),
  13,
  'every public table is covered above (add new tables to this test)'
);

select * from finish();
rollback;
