-- save_recipe: atomic create/replace of a whole recipe from a RecipeDraft; search and timestamps.
begin;
select plan(30);

select tests.create_user('a0000000-0000-4000-8000-00000000000a', 'alice@example.test');
select tests.create_user('b0000000-0000-4000-8000-00000000000b', 'bob@example.test');
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');

select is(
  public.save_recipe(tests.sample_draft('c0000000-0000-4000-8000-00000000000c')),
  'c0000000-0000-4000-8000-00000000000c'::uuid,
  'returns the draft id'
);

-- Everything round-trips, in order
select results_eq(
  $$ select title, yield_text, prep_minutes, cook_minutes, source_url, servings from public.recipe $$,
  $$ values ('Onion Soup', '4 bowls', 15, 60, 'https://example.test/soup', 4::numeric) $$,
  'stores recipe fields'
);
select results_eq(
  $$ select kind::text, position, title from public.recipe_section order by kind, position $$,
  $$ values ('ingredients', 0, null::text), ('ingredients', 1, 'To serve'), ('steps', 0, null) $$,
  'stores sections in order with titles'
);
select results_eq(
  $$ select i.item, s.position, i.position, i.qty_min, i.qty_max, i.unit, i.prep_note, i.note, i.optional, i.raw_text
     from public.ingredient i join public.recipe_section s on s.id = i.section_id order by s.position, i.position $$,
  $$ values ('onions', 0, 0, 1::numeric, null::numeric, 'kg', 'sliced', null::text, false, '1kg onions, sliced'),
            ('butter', 0, 1, 50, null, 'g', null, null, false, '50g butter'),
            ('beef stock', 1, 0, 1, 1.5, 'l', null, 'or vegetable', true, '1-1.5l beef stock (or vegetable)') $$,
  'stores ingredients with every field, per section in order'
);
select results_eq(
  $$ select position, glossary_suppress, image_path from public.step order by position $$,
  $$ values (0, '{}'::text[], null::text), (1, '{simmer}'::text[], null) $$,
  'stores steps with glossary suppressions'
);
select results_eq(
  $$ select i.item, si.amount_fraction from public.step_ingredient si join public.ingredient i on i.id = si.ingredient_id
     join public.step s on s.id = si.step_id order by s.position, i.item $$,
  $$ values ('butter', 1::numeric), ('onions', 1::numeric), ('beef stock', 0.5::numeric) $$,
  'links steps to ingredients with fractions'
);
select results_eq(
  $$ select name from public.tag order by name $$,
  $$ values ('Soup'), ('Winter') $$,
  'creates distinct tags, case-insensitively and trimmed'
);

-- Search covers ingredients and tags, with stemming
select ok((select search @@ websearch_to_tsquery('english', 'butter') from public.recipe), 'search matches an ingredient');
select ok((select search @@ websearch_to_tsquery('english', 'winter') from public.recipe), 'search matches a tag');

-- Timestamps: backdate, then check what bumps updated_at
select tests.clear_authentication();
set local session_replication_role = replica;
update public.recipe set updated_at = '2000-01-01';
set local session_replication_role = origin;
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');

insert into public.tag (id, name) values ('70000000-0000-4000-8000-000000000007', 'Hearty');
insert into public.recipe_tag (recipe_id, tag_id) values ('c0000000-0000-4000-8000-00000000000c', '70000000-0000-4000-8000-000000000007');
select ok((select search @@ websearch_to_tsquery('english', 'hearty') from public.recipe), 'tagging outside save_recipe re-indexes');
select is((select updated_at from public.recipe), '2000-01-01'::timestamptz, 'tagging does not bump updated_at');

update public.tag set name = 'Frosty' where name = 'Winter';
select ok(
  (select search @@ websearch_to_tsquery('english', 'frosty') and not search @@ websearch_to_tsquery('english', 'winter') from public.recipe),
  'renaming a tag re-indexes'
);
update public.ingredient set item = 'leeks' where item = 'onions';
select ok((select search @@ websearch_to_tsquery('english', 'leek') from public.recipe), 'editing an ingredient re-indexes');

update public.recipe set created_at = '1999-01-01', updated_at = '1999-01-01';
select ok((select created_at > '2000-01-02' and updated_at > '2000-01-02' from public.recipe), 'clients cannot set timestamps');

-- Re-save replaces structure but keeps per-user data
insert into public.user_recipe_meta (recipe_id, rating) values ('c0000000-0000-4000-8000-00000000000c', 5);
select lives_ok(
  $$ select public.save_recipe(
       jsonb_set(
         jsonb_set(
           jsonb_set(tests.sample_draft('c0000000-0000-4000-8000-00000000000c'), '{title}', '"French Onion Soup"'),
           '{ingredientSections}', (tests.sample_draft('c0000000-0000-4000-8000-00000000000c') #> '{ingredientSections}') - 1),
         '{tags}', '["Soup"]'
       ) #- '{stepSections,0,steps,1,ingredientRefs}'
     ) $$,
  'can re-save an edited draft'
);
select is((select title from public.recipe), 'French Onion Soup', 'updates recipe fields');
select is((select count(*) from public.ingredient), 2::bigint, 'removes dropped ingredients');
select is((select count(*) from public.recipe_tag), 1::bigint, 'removes dropped tag links');
select is((select count(*) from public.user_recipe_meta where rating = 5), 1::bigint, 'keeps per-user metadata');
select lives_ok(
  $$ select public.save_recipe(tests.sample_draft('c0000000-0000-4000-8000-00000000000c')),
            public.save_recipe(tests.sample_draft('c0000000-0000-4000-8000-00000000000c')) $$,
  're-sending the same draft is idempotent'
);

-- Validation and atomicity
select lives_ok(
  $$ select public.save_recipe(tests.sample_draft('c1000000-0000-4000-8000-00000000000c')) $$,
  'a second recipe with its own ids can be saved'
);
select throws_ok(
  $$ select public.save_recipe(
       jsonb_set(tests.sample_draft('c1000000-0000-4000-8000-00000000000c'),
         '{stepSections,0,steps,0,ingredientRefs,0,ingredientId}',
         to_jsonb(tests.id('c0000000-0000-4000-8000-00000000000c', 'butter')))) $$,
  '23503', null,
  'rejects a step reference to an ingredient of another recipe'
);
select is(
  (select count(*) from public.step where recipe_id = 'c1000000-0000-4000-8000-00000000000c'),
  2::bigint,
  'a failed save leaves the previous version intact'
);
select throws_ok(
  $$ select public.save_recipe(jsonb_set(tests.sample_draft(gen_random_uuid()), '{title}', to_jsonb(E' \t '::text))) $$,
  '23514', null,
  'rejects a whitespace-only title'
);
select throws_ok(
  $$ select public.save_recipe(tests.sample_draft(gen_random_uuid()) - 'id') $$,
  '22023', null,
  'requires a recipe id'
);
select lives_ok(
  $$ select public.save_recipe(jsonb_set(jsonb_set(tests.sample_draft('c2000000-0000-4000-8000-00000000000c'),
       '{stepSections,0,steps,0,glossarySuppress}', 'null'), '{stepSections,0,steps,0,ingredientRefs}', 'null')) $$,
  'treats JSON null arrays as empty'
);
select throws_ok(
  $$ select public.save_recipe(jsonb_set(tests.sample_draft(gen_random_uuid()), '{tags}',
       (select jsonb_agg('tag' || g) from generate_series(1, 31) g))) $$,
  '54000', null,
  'rejects drafts over the size limits'
);

-- Tags are per user; deleting a recipe cascades to its structure but keeps tags
select tests.authenticate_as('b0000000-0000-4000-8000-00000000000b');
select lives_ok(
  $$ select public.save_recipe(tests.sample_draft('b1000000-0000-4000-8000-00000000000b')) $$,
  'another user can have tags with the same names'
);
select tests.authenticate_as('a0000000-0000-4000-8000-00000000000a');
delete from public.recipe where id = 'c0000000-0000-4000-8000-00000000000c';
select results_eq(
  $$ select (select count(*) from public.recipe_section where recipe_id = 'c0000000-0000-4000-8000-00000000000c')
          + (select count(*) from public.ingredient where recipe_id = 'c0000000-0000-4000-8000-00000000000c')
          + (select count(*) from public.step_ingredient where recipe_id = 'c0000000-0000-4000-8000-00000000000c')
          + (select count(*) from public.user_recipe_meta where recipe_id = 'c0000000-0000-4000-8000-00000000000c'),
            (select count(*) > 0 from public.tag) $$,
  $$ values (0::bigint, true) $$,
  'deleting a recipe removes its structure and metadata but not tags'
);

select tests.as_anon();
select throws_ok(
  $$ select public.save_recipe(tests.sample_draft(gen_random_uuid())) $$,
  '42501', null,
  'anonymous callers cannot save'
);

select * from finish();
rollback;
