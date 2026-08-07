-- WMS Phase 3 — Tooling, tenders, maintenance, correspondence

-- ── 1.7 Tooling & gauges ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_tooling (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_code                 text NOT NULL,
  name                      text NOT NULL,
  tool_type                 text NOT NULL DEFAULT 'tool'
                            CHECK (tool_type IN ('tool', 'gauge', 'fixture', 'other')),
  location                  text,
  machine_id                uuid REFERENCES public.wms_machines(id) ON DELETE SET NULL,
  calibration_required      boolean NOT NULL DEFAULT false,
  calibration_interval_days integer CHECK (calibration_interval_days IS NULL OR calibration_interval_days > 0),
  last_calibration_date     date,
  next_calibration_date     date,
  notes                     text,
  is_active                 boolean NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_tooling_code_unique UNIQUE (tool_code)
);

CREATE INDEX IF NOT EXISTS idx_wms_tooling_machine ON public.wms_tooling(machine_id);
CREATE INDEX IF NOT EXISTS idx_wms_tooling_cal_due ON public.wms_tooling(next_calibration_date);

-- ── Tender alerts ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_tenders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_no         text NOT NULL,
  title             text NOT NULL,
  customer_id       uuid REFERENCES public.wms_customers(id) ON DELETE SET NULL,
  portal_ref        text,
  published_date    date,
  submission_due    date NOT NULL,
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'submitted', 'won', 'lost', 'cancelled')),
  estimated_value   numeric(14, 2),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_tenders_no_unique UNIQUE (tender_no)
);

CREATE INDEX IF NOT EXISTS idx_wms_tenders_due ON public.wms_tenders(submission_due);

-- ── Preventive maintenance ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_maintenance_plans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code         text NOT NULL,
  machine_id        uuid NOT NULL REFERENCES public.wms_machines(id) ON DELETE RESTRICT,
  title             text NOT NULL,
  frequency_days    integer NOT NULL CHECK (frequency_days > 0),
  last_done_date    date,
  next_due_date     date,
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_maintenance_plans_code_unique UNIQUE (plan_code)
);

CREATE INDEX IF NOT EXISTS idx_wms_maint_plans_machine ON public.wms_maintenance_plans(machine_id);
CREATE INDEX IF NOT EXISTS idx_wms_maint_plans_due ON public.wms_maintenance_plans(next_due_date);

CREATE TABLE IF NOT EXISTS public.wms_maintenance_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id           uuid REFERENCES public.wms_maintenance_plans(id) ON DELETE SET NULL,
  machine_id        uuid NOT NULL REFERENCES public.wms_machines(id) ON DELETE RESTRICT,
  work_date         date NOT NULL DEFAULT CURRENT_DATE,
  work_done         text NOT NULL,
  downtime_hours    numeric(8, 2),
  performed_by      text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wms_maint_logs_machine ON public.wms_maintenance_logs(machine_id);

-- ── Correspondence ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_correspondence (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corr_no           text NOT NULL,
  direction         text NOT NULL DEFAULT 'outbound'
                    CHECK (direction IN ('inbound', 'outbound')),
  customer_id       uuid REFERENCES public.wms_customers(id) ON DELETE SET NULL,
  po_id             uuid REFERENCES public.wms_purchase_orders(id) ON DELETE SET NULL,
  subject           text NOT NULL,
  corr_date         date NOT NULL DEFAULT CURRENT_DATE,
  reference_no      text,
  channel           text NOT NULL DEFAULT 'letter'
                    CHECK (channel IN ('letter', 'email', 'portal', 'phone', 'other')),
  summary           text,
  follow_up_date    date,
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_correspondence_no_unique UNIQUE (corr_no)
);

CREATE INDEX IF NOT EXISTS idx_wms_corr_customer ON public.wms_correspondence(customer_id);
CREATE INDEX IF NOT EXISTS idx_wms_corr_follow ON public.wms_correspondence(follow_up_date);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wms_tooling ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_tenders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_maintenance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_correspondence ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wms_tooling', 'wms_tenders', 'wms_maintenance_plans', 'wms_maintenance_logs', 'wms_correspondence'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS wms_%s_select ON public.%I', replace(t, 'wms_', ''), t);
    EXECUTE format('DROP POLICY IF EXISTS wms_%s_write ON public.%I', replace(t, 'wms_', ''), t);
    EXECUTE format(
      'CREATE POLICY wms_%s_select ON public.%I FOR SELECT TO authenticated USING (public.wms_can_read_masters())',
      replace(t, 'wms_', ''), t
    );
    EXECUTE format(
      'CREATE POLICY wms_%s_write ON public.%I FOR ALL TO authenticated USING (public.wms_is_ops_admin()) WITH CHECK (public.wms_is_ops_admin())',
      replace(t, 'wms_', ''), t
    );
  END LOOP;
END $$;
