-- Allow anonymous and authenticated users to request device approval
-- This migration enables the device approval request flow before login

-- Check if RLS is enabled on user_devices
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to replace them
DROP POLICY IF EXISTS "authenticated_insert_user_devices" ON public.user_devices;
DROP POLICY IF EXISTS "public_insert_user_devices" ON public.user_devices;
DROP POLICY IF EXISTS "users_insert_user_devices" ON public.user_devices;
DROP POLICY IF EXISTS "authenticated_update_user_devices" ON public.user_devices;
DROP POLICY IF EXISTS "authenticated_select_user_devices" ON public.user_devices;

-- Allow BOTH anonymous (anon) and authenticated users to INSERT device approval requests
CREATE POLICY "anyone_insert_user_devices" ON public.user_devices
  FOR INSERT
  WITH CHECK (true);

-- Allow authenticated users to UPDATE device records (for approval flow)
CREATE POLICY "authenticated_update_user_devices" ON public.user_devices
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to SELECT device records
CREATE POLICY "authenticated_select_user_devices" ON public.user_devices
  FOR SELECT TO authenticated
  USING (true);

