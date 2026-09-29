-- save_recipe: atomic create/replace of a whole recipe from a RecipeDraft.
begin;
select plan(19);

select tests.create_user('a0000000-0000-4000-8000-00000000000a', 'alice@example.test');
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');

select is(
  public.save_recipe(tests.sample_draft('c0000000-0000-4000-8000-00000000000c')),
  'c0000000-0000-4000-8000-00000000000c'::uuid,
  'returns the draft id'
);

-- Structure is stored in order with client ids
select results_eq(
  $$ select kind::text, position from public.recipe_section order by kind, position $$,
  $$ values ('ingredients', 0), ('steps', 0) $$,
  'creates one section of each kind'
);
select results_eq(
  $$ select item, position, qty_min, unit from public.ingredient order by position $$,
  $$ values ('onions', 0, 1::numeric, 'kg'), ('butter', 1, 50::numeric, 'g'), ('beef stock', 2, 1::numeric, 'l') $$,
  'stores ingredients in order'
);
select results_eq(
  $$ select position, glossary_suppress from public.step order by position $$,
  $$ values (0, '{}'::text[]), (1, '{simmer}'::text[]) $$,
  'stores steps with glossary suppressions'
);
select results_eq(
  $$ select i.item, si.amount_fraction from public.step_ingredient si join public.ingredient i on i.id = si.ingredient_id
     order by si.step_id, i.position $$,
  $$ values ('onions', 1::numeric), ('butter', 1::numeric), ('beef stock', 0.5::numeric) $$,
  'links steps to ingredients with fractions'
);

-- Tags are de-duplicated case-insensitively and trimmed
select results_eq(
  $$ select name from public.tag order by name $$,
  $$ values ('Soup'), ('Winter') $$,
  'creates distinct tags'
);
select is((select count(*) from public.recipe_tag), 2::bigint, 'links both tags');

-- Search covers title, ingredients and tags, with stemming
select ok(
  (select search @@ websearch_to_tsquery('english', 'onion') from public.recipe),
  'search matches an ingredient (stemmed)'
);
select ok(
  (select search @@ websearch_to_tsquery('english', 'winter') from public.recipe),
  'search matches a tag'
);

-- Re-save replaces structure but keeps per-user data
insert into public.user_recipe_meta (recipe_id, rating) values ('c0000000-0000-4000-8000-00000000000c', 5);
select lives_ok(
  $$ select public.save_recipe(
       jsonb_set(
         jsonb_set(tests.sample_draft('c0000000-0000-4000-8000-00000000000c'), '{title}', '"French Onion Soup"'),
         '{ingredientSections,0,ingredients}',
         (tests.sample_draft('c0000000-0000-4000-8000-00000000000c') #> '{ingredientSections,0,ingredients}') - 2
       ) #- '{stepSections,0,steps,1,ingredientRefs}'
     ) $$,
  'can re-save an edited draft'
);
select is((select title from public.recipe), 'French Onion Soup', 'updates recipe fields');
select is((select count(*) from public.ingredient), 2::bigint, 'removes dropped ingredients');
select is((select count(*) from public.user_recipe_meta where rating = 5), 1::bigint, 'keeps per-user metadata');
select is((select count(*) from public.tag), 2::bigint, 'reuses existing tags');
select ok(
  (select updated_at >= created_at from public.recipe),
  'maintains updated_at'
);

-- Atomicity: a bad reference rolls back the whole save
select throws_ok(
  $$ select public.save_recipe(
       jsonb_set(tests.sample_draft('c0000000-0000-4000-8000-00000000000c'),
         '{stepSections,0,steps,0,ingredientRefs,0,ingredientId}', '"99999999-0000-4000-8000-000000000000"')
     ) $$,
  '23503', null,
  'rejects a step reference to an ingredient outside the recipe'
);
select is((select title from public.recipe), 'French Onion Soup', 'failed save leaves the previous version intact');

select throws_ok(
  $$ select public.save_recipe(jsonb_set(tests.sample_draft(gen_random_uuid()), '{title}', '"  "')) $$,
  '23514', null,
  'rejects a blank title'
);

select tests.as_anon();
select throws_ok(
  $$ select public.save_recipe(tests.sample_draft(gen_random_uuid())) $$,
  '42501', null,
  'anonymous callers cannot save'
);

select * from finish();
rollback;
