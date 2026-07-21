-- Device registry table for companion / device-based login metadata
CREATE TABLE IF NOT EXISTS public.user_devices (
  id             uuid        not null default gen_random_uuid(),
  user_id        uuid        null,
  device_id      text        not null,
  org_name       text        null,
  user_name      text        null,
  location       text        null,
  designation    text        null,
  avatar_name    text        null,
  registered_at  timestamp with time zone not null default now(),
  constraint user_devices_pkey primary key (id),
  constraint user_devices_device_id_key unique (device_id),
  constraint user_devices_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON public.user_devices USING btree (device_id) TABLESPACE pg_default;

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- Allow service-role access only by default; app uses adminSupabase for device registration.
DROP POLICY IF EXISTS "authenticated_insert_user_devices" ON public.user_devices;
CREATE POLICY "authenticated_insert_user_devices" ON public.user_devices
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_update_user_devices" ON public.user_devices;
CREATE POLICY "authenticated_update_user_devices" ON public.user_devices
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
