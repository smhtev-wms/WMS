-- WMS Phase 4 — Job costing, receivables, HR-lite

-- Labor rate on operators (for DPR cost roll-up)
ALTER TABLE public.wms_operators
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10, 2);

-- ── Job cost entries (manual / subcontract / overhead) ────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_job_cost_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id     uuid NOT NULL REFERENCES public.wms_job_cards(id) ON DELETE CASCADE,
  cost_type       text NOT NULL DEFAULT 'other'
                  CHECK (cost_type IN ('material', 'labor', 'subcontract', 'overhead', 'other')),
  description     text NOT NULL,
  amount          numeric(14, 2) NOT NULL CHECK (amount >= 0),
  cost_date       date NOT NULL DEFAULT CURRENT_DATE,
  reference       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wms_job_cost_job ON public.wms_job_cost_entries(job_card_id);

-- ── Customer receivables (payment ageing) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_customer_receivables (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no        text NOT NULL,
  customer_id       uuid NOT NULL REFERENCES public.wms_customers(id) ON DELETE RESTRICT,
  po_id             uuid REFERENCES public.wms_purchase_orders(id) ON DELETE SET NULL,
  dispatch_id       uuid REFERENCES public.wms_dispatches(id) ON DELETE SET NULL,
  invoice_date      date NOT NULL DEFAULT CURRENT_DATE,
  due_date          date NOT NULL,
  gross_amount      numeric(14, 2) NOT NULL CHECK (gross_amount >= 0),
  amount_received   numeric(14, 2) NOT NULL DEFAULT 0 CHECK (amount_received >= 0),
  status            text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'partial', 'paid', 'written_off')),
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_customer_receivables_no_unique UNIQUE (invoice_no),
  CONSTRAINT wms_receivables_received_lte_gross CHECK (amount_received <= gross_amount)
);

CREATE INDEX IF NOT EXISTS idx_wms_receivables_customer ON public.wms_customer_receivables(customer_id);
CREATE INDEX IF NOT EXISTS idx_wms_receivables_due ON public.wms_customer_receivables(due_date);

-- ── Attendance (HR-lite) ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_attendance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id     uuid NOT NULL REFERENCES public.wms_operators(id) ON DELETE CASCADE,
  work_date       date NOT NULL,
  status          text NOT NULL DEFAULT 'present'
                  CHECK (status IN ('present', 'absent', 'leave', 'holiday', 'half_day')),
  hours_worked    numeric(5, 2) NOT NULL DEFAULT 8 CHECK (hours_worked >= 0 AND hours_worked <= 24),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_attendance_operator_date_unique UNIQUE (operator_id, work_date)
);

CREATE INDEX IF NOT EXISTS idx_wms_attendance_date ON public.wms_attendance(work_date);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wms_job_cost_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_customer_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_attendance ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wms_job_cost_entries', 'wms_customer_receivables', 'wms_attendance'
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
