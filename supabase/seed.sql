-- Create initial test user
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'test@example.com',
  crypt('password123', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
);

-- Create initial organization
INSERT INTO public.organizations (id, name, owner_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Test Organization',
  '00000000-0000-0000-0000-000000000000'
);

-- Create initial profile
INSERT INTO public.profiles (id, org_id, email, role)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'test@example.com',
  'admin'
); 