-- WMS Phase 5 — Audit, RBAC matrix, notifications

-- ── Audit log ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email      text,
  action          text NOT NULL
                  CHECK (action IN ('create', 'update', 'delete', 'view', 'system', 'login')),
  module          text NOT NULL,
  entity_table    text,
  entity_id       text,
  summary         text NOT NULL,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wms_audit_created ON public.wms_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wms_audit_module ON public.wms_audit_log(module);

-- ── Per-module RBAC (overrides default role behavior in app) ─────────────────
CREATE TABLE IF NOT EXISTS public.wms_role_permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role            text NOT NULL,
  module          text NOT NULL,
  can_read        boolean NOT NULL DEFAULT true,
  can_write       boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_role_permissions_unique UNIQUE (role, module)
);

CREATE INDEX IF NOT EXISTS idx_wms_role_perm_role ON public.wms_role_permissions(role);

-- Seed defaults (idempotent)
INSERT INTO public.wms_role_permissions (role, module, can_read, can_write)
SELECT r.role, m.module, r.can_read, r.can_write
FROM (VALUES
  ('super_admin', true, true),
  ('admin1', true, true),
  ('admin', true, true),
  ('user', true, false),
  ('demo', true, true)
) AS r(role, can_read, can_write)
CROSS JOIN (VALUES
  ('masters'), ('orders'), ('planning'), ('shop'), ('stores'),
  ('quality'), ('dispatch'), ('engineering'), ('commercial'),
  ('maintenance'), ('insights'), ('hr'), ('admin')
) AS m(module)
ON CONFLICT (role, module) DO NOTHING;

-- ── In-app notifications ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  body            text NOT NULL,
  severity        text NOT NULL DEFAULT 'info'
                  CHECK (severity IN ('info', 'warning', 'urgent')),
  link_path       text,
  source_type     text,
  source_id       text,
  is_read         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wms_notif_user ON public.wms_notifications(user_id, is_read);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wms_notif_source
  ON public.wms_notifications(source_type, source_id)
  WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wms_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_notifications ENABLE ROW LEVEL SECURITY;

-- Audit: ops admins read; insert authenticated (app logs own actions)
DROP POLICY IF EXISTS wms_audit_log_select ON public.wms_audit_log;
CREATE POLICY wms_audit_log_select ON public.wms_audit_log
  FOR SELECT TO authenticated USING (public.wms_is_ops_admin());

DROP POLICY IF EXISTS wms_audit_log_insert ON public.wms_audit_log;
CREATE POLICY wms_audit_log_insert ON public.wms_audit_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Permissions: read all authenticated with master read; write super_admin only
DROP POLICY IF EXISTS wms_role_permissions_select ON public.wms_role_permissions;
CREATE POLICY wms_role_permissions_select ON public.wms_role_permissions
  FOR SELECT TO authenticated USING (public.wms_can_read_masters());

DROP POLICY IF EXISTS wms_role_permissions_write ON public.wms_role_permissions;
CREATE POLICY wms_role_permissions_write ON public.wms_role_permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin')
  );

-- Notifications: own rows + broadcast (user_id null) for ops admins
DROP POLICY IF EXISTS wms_notifications_select ON public.wms_notifications;
CREATE POLICY wms_notifications_select ON public.wms_notifications
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND public.wms_is_ops_admin())
  );

DROP POLICY IF EXISTS wms_notifications_update ON public.wms_notifications;
CREATE POLICY wms_notifications_update ON public.wms_notifications
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid()
    OR (user_id IS NULL AND public.wms_is_ops_admin())
  );

DROP POLICY IF EXISTS wms_notifications_insert ON public.wms_notifications;
CREATE POLICY wms_notifications_insert ON public.wms_notifications
  FOR INSERT TO authenticated WITH CHECK (public.wms_is_ops_admin());

DROP POLICY IF EXISTS wms_notifications_delete ON public.wms_notifications;
CREATE POLICY wms_notifications_delete ON public.wms_notifications
  FOR DELETE TO authenticated USING (public.wms_is_ops_admin());
