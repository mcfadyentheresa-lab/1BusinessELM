/*
  # Fix Security Definer Function Vulnerabilities

  1. Changes
    - Set `search_path = ''` on `public.handle_new_user` to prevent mutable search_path exploit
    - Revoke EXECUTE on `public.get_my_role()` from `anon` and `authenticated` roles
    - Revoke EXECUTE on `public.handle_new_user()` from `anon` and `authenticated` roles

  2. Security
    - `handle_new_user` is a trigger function and should never be callable via RPC
    - `get_my_role` is used internally by RLS policies via `auth.uid()` context; 
      direct RPC execution by anon/authenticated is not needed and is a security risk
*/

-- Fix mutable search_path on handle_new_user
ALTER FUNCTION public.handle_new_user() SET search_path = '';

-- Revoke public RPC access to SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
