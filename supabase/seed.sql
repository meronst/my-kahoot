-- supabase/seed.sql — demo data for LOCAL development and CI only.
--
-- Runs automatically after the migrations on `supabase start` / `supabase db reset`.
-- It is NOT applied to the cloud project (db push doesn't include the seed).
--
-- Creates:
--   - a demo host account: demo-host@my-kahoot.local / demo-password-123  (local only!)
--   - a demo quiz: 2 rounds, multiple-choice + true/false questions

-- Fixed ids make the data easy to reference from tests.
-- Host user: inserted straight into Supabase's auth tables (only acceptable in a local seed).
-- The empty-string token columns matter: the auth server fails on NULLs there.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated', 'authenticated',
  'demo-host@my-kahoot.local',
  extensions.crypt('demo-password-123', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', ''
);

-- An identity row links the user to the email/password login method.
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  'email',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"demo-host@my-kahoot.local","email_verified":true}',
  now(), now(), now()
);

insert into public.quizzes (id, owner_id, title, scoring_mode)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'חידון לדוגמה', 'speed');

insert into public.rounds (id, quiz_id, position, title) values
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222222', 0, 'סבב ראשון'),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222222', 1, 'סבב שני');

insert into public.questions (round_id, position, type, text, time_limit_sec, explanation, options) values
  ('33333333-3333-3333-3333-333333333301', 0, 'mc',
   'איזו עיר היא בירת ישראל?', 20, 'ירושלים היא בירת ישראל.',
   '[{"text":"תל אביב","correct":false},{"text":"ירושלים","correct":true},{"text":"חיפה","correct":false},{"text":"באר שבע","correct":false}]'),
  ('33333333-3333-3333-3333-333333333301', 1, 'tf',
   'ים המלח הוא המקום הנמוך ביותר ביבשה על פני כדור הארץ.', 15, 'חופי ים המלח נמצאים כ-430 מטר מתחת לפני הים.',
   '[{"text":"נכון","correct":true},{"text":"לא נכון","correct":false}]'),
  ('33333333-3333-3333-3333-333333333302', 0, 'mc',
   'כמה ימים יש בשבוע?', null, null,
   '[{"text":"5","correct":false},{"text":"6","correct":false},{"text":"7","correct":true}]');
