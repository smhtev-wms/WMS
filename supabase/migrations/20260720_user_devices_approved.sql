-- Add approval fields to user_devices so admins can approve companion devices
ALTER TABLE public.user_devices
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_by uuid NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS requested_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS valid_upto timestamptz NULL,
  ADD COLUMN IF NOT EXISTS device_name text NULL;

UPDATE public.user_devices
SET status = CASE
  WHEN approved = true THEN 'approved'
  WHEN approved_by IS NOT NULL AND approved_at IS NOT NULL THEN 'rejected'
  ELSE 'pending'
END
WHERE status IS NULL OR status = '';

CREATE INDEX IF NOT EXISTS idx_user_devices_approved ON public.user_devices USING btree (approved);
CREATE INDEX IF NOT EXISTS idx_user_devices_status ON public.user_devices USING btree (status);

DROP POLICY IF EXISTS "authenticated_insert_user_devices" ON public.user_devices;
CREATE POLICY "authenticated_insert_user_devices" ON public.user_devices
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_user_devices" ON public.user_devices;
CREATE POLICY "authenticated_update_user_devices" ON public.user_devices
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_user_devices" ON public.user_devices;
CREATE POLICY "authenticated_select_user_devices" ON public.user_devices
  FOR SELECT TO authenticated
  USING (true);
