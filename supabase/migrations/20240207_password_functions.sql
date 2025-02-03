-- Migration: Password Functions
-- Description: Add password hashing function using pgcrypto
-- Created at: 2024-02-07T00:00:00Z

-- Create password hashing function using pgcrypto
CREATE OR REPLACE FUNCTION public.hash_password(password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use pgcrypto's crypt function with a random salt
  RETURN crypt(password, gen_salt('bf', 10));
END;
$$;

-- Create password verification function
CREATE OR REPLACE FUNCTION public.verify_password(password TEXT, hashed_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use pgcrypto's crypt function to verify password
  RETURN hashed_password = crypt(password, hashed_password);
END;
$$;

-- Disable RLS for these functions
ALTER FUNCTION public.hash_password(TEXT) SECURITY DEFINER;
ALTER FUNCTION public.verify_password(TEXT, TEXT) SECURITY DEFINER;

-- Grant execute permissions to anon role
GRANT EXECUTE ON FUNCTION public.hash_password(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_password(TEXT, TEXT) TO anon; 