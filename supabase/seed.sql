-- Local development seed only (never run against the hosted project).

-- Sign-up is disabled (config.toml), so seed a user to sign in as: request a code for this address
-- and read it in Mailpit (http://127.0.0.1:54324).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000', 'd0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'dev@mise.test', '', now(), '{"provider": "email", "providers": ["email"]}', '{}', now(), now(), '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
values (
  gen_random_uuid(), 'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001',
  '{"sub": "d0000000-0000-4000-8000-000000000001", "email": "dev@mise.test", "email_verified": true}',
  'email', now(), now()
);

-- Glossary terms are global content; production gets them via a migration once the curated list is
-- agreed (docs/PLAN.md open question: glossary source).
insert into public.glossary_term (slug, term, aliases, definition, match_rules, plain_phrasing) values
  ('sous-vide', 'sous vide', '{}',
   'Cooking food sealed in a bag in a water bath held at a precise, low temperature.',
   '{}', 'cook in a sealed bag in a temperature-controlled water bath'),
  ('deglaze', 'deglaze', '{}',
   'Adding liquid to a hot pan to lift the browned bits stuck to the bottom into a sauce.',
   '{}', 'pour in liquid and scrape up the browned bits'),
  ('fold', 'fold', '{}',
   'Gently combining a light mixture into a heavier one with a cutting and turning motion, keeping the air in.',
   '{"excludeNear": ["pastry", "dough", "half", "over", "napkin", "edges", "sides"]}',
   'gently mix in without stirring hard'),
  ('reduce', 'reduce', '{}',
   'Simmering a liquid uncovered so water evaporates and it thickens and intensifies in flavour.',
   '{"excludeNear": ["heat", "temperature", "oven", "speed", "flame"]}',
   'simmer uncovered until thicker'),
  ('blanch', 'blanch', '{}',
   'Briefly boiling food, then plunging it into cold water to stop it cooking.',
   '{}', 'boil briefly, then cool in cold water'),
  ('julienne', 'julienne', '{}',
   'Cutting into long, thin matchstick strips.',
   '{}', 'cut into thin matchsticks'),
  ('chiffonade', 'chiffonade', '{}',
   'Stacking and rolling leaves, then slicing across into fine ribbons.',
   '{}', 'roll up the leaves and slice into thin ribbons'),
  ('temper', 'temper', '{"tempering"}',
   'Slowly raising the temperature of a delicate ingredient (like eggs) by adding hot liquid gradually so it doesn''t curdle.',
   '{"excludeNear": ["spices", "spice", "chocolate"]}',
   'add the hot liquid a little at a time while stirring'),
  ('cream', 'cream', '{}',
   'Beating butter and sugar together until pale and fluffy.',
   '{"requireNear": ["butter", "sugar", "margarine"]}',
   'beat until pale and fluffy');
