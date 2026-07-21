-- Login audit log table
CREATE TABLE IF NOT EXISTS public.login_logs (
  id           uuid        not null default gen_random_uuid(),
  user_id      uuid null,
  email        text not null,
  full_name    text null,
  user_role    text null,
  designation  text null,
  login_type   text not null default 'trustgate',
  ip_address   text null,
  city         text null,
  region       text null,
  country      text null,
  user_agent   text null,
  browser      text null,
  os           text null,
  login_at     timestamp with time zone not null default now(),
  logout_at    timestamp with time zone null,
  created_at   timestamp with time zone not null default now(),
  device_id    text null,
  user_name    text null,
  location     text null,
  org          text null,
  constraint login_logs_pkey primary key (id),
  constraint login_logs_user_id_fkey foreign key (user_id) references auth.users (id) on delete set null
) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_login_logs_login_at ON public.login_logs USING btree (login_at desc) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON public.login_logs USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_login_logs_email ON public.login_logs USING btree (email) TABLESPACE pg_default;

ALTER TABLE public.login_logs ADD COLUMN IF NOT EXISTS designation text null;
ALTER TABLE public.login_logs ADD COLUMN IF NOT EXISTS login_type text not null default 'trustgate';
ALTER TABLE public.login_logs ADD COLUMN IF NOT EXISTS browser text null;
ALTER TABLE public.login_logs ADD COLUMN IF NOT EXISTS os text null;
ALTER TABLE public.login_logs ADD COLUMN IF NOT EXISTS duration_seconds int null;
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own login session rows
DROP POLICY IF EXISTS "authenticated_insert_login_logs" ON public.login_logs;
CREATE POLICY "authenticated_insert_login_logs" ON public.login_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Only admins can read logs
DROP POLICY IF EXISTS "admins_read_login_logs" ON public.login_logs;
CREATE POLICY "admins_read_login_logs" ON public.login_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id  = auth.uid()
        AND profiles.role IN ('super_admin', 'admin', 'admin1')
    )
  );

-- Allow the signed-in user to update their own login session row
DROP POLICY IF EXISTS "authenticated_update_login_logs" ON public.login_logs;
CREATE POLICY "authenticated_update_login_logs" ON public.login_logs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
