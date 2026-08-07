-- WMS Sprint D — Shop floor (job cards, operation progress, DPR, downtime)

CREATE TABLE IF NOT EXISTS public.wms_job_cards (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number      text NOT NULL,
  po_line_id      uuid NOT NULL REFERENCES public.wms_po_lines(id) ON DELETE RESTRICT,
  item_id         uuid REFERENCES public.wms_items(id) ON DELETE SET NULL,
  qty_ordered     numeric(14, 3) NOT NULL CHECK (qty_ordered > 0),
  qty_completed   numeric(14, 3) NOT NULL DEFAULT 0 CHECK (qty_completed >= 0),
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'in_progress', 'inspection', 'complete', 'closed', 'cancelled')),
  priority        text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent')),
  due_date        date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_job_cards_number_unique UNIQUE (job_number),
  CONSTRAINT wms_job_cards_po_line_unique UNIQUE (po_line_id)
);

CREATE INDEX IF NOT EXISTS idx_wms_job_cards_status ON public.wms_job_cards(status);

CREATE TABLE IF NOT EXISTS public.wms_job_operations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_card_id         uuid NOT NULL REFERENCES public.wms_job_cards(id) ON DELETE CASCADE,
  route_operation_id  uuid REFERENCES public.wms_route_operations(id) ON DELETE SET NULL,
  op_seq              int NOT NULL,
  operation_name      text NOT NULL,
  machine_id          uuid REFERENCES public.wms_machines(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_progress', 'done', 'skipped')),
  qty_done            numeric(14, 3) NOT NULL DEFAULT 0,
  started_at          timestamptz,
  completed_at        timestamptz,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_job_ops_seq_unique UNIQUE (job_card_id, op_seq)
);

CREATE INDEX IF NOT EXISTS idx_wms_job_ops_card ON public.wms_job_operations(job_card_id);

CREATE TABLE IF NOT EXISTS public.wms_dpr_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date         date NOT NULL DEFAULT CURRENT_DATE,
  job_card_id         uuid NOT NULL REFERENCES public.wms_job_cards(id) ON DELETE CASCADE,
  job_operation_id    uuid REFERENCES public.wms_job_operations(id) ON DELETE SET NULL,
  operator_id         uuid REFERENCES public.wms_operators(id) ON DELETE SET NULL,
  machine_id          uuid REFERENCES public.wms_machines(id) ON DELETE SET NULL,
  qty_produced        numeric(14, 3) NOT NULL DEFAULT 0,
  qty_rejected        numeric(14, 3) NOT NULL DEFAULT 0,
  hours_spent         numeric(8, 2) NOT NULL DEFAULT 0,
  shift               text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wms_dpr_date ON public.wms_dpr_entries(report_date);
CREATE INDEX IF NOT EXISTS idx_wms_dpr_job ON public.wms_dpr_entries(job_card_id);

CREATE TABLE IF NOT EXISTS public.wms_downtime_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id      uuid NOT NULL REFERENCES public.wms_machines(id) ON DELETE RESTRICT,
  started_at      timestamptz NOT NULL,
  ended_at        timestamptz,
  category        text NOT NULL DEFAULT 'other'
                  CHECK (category IN ('breakdown', 'setup', 'maintenance', 'power', 'material', 'other')),
  reason          text NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_downtime_end_after_start CHECK (ended_at IS NULL OR ended_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_wms_downtime_machine ON public.wms_downtime_logs(machine_id);
CREATE INDEX IF NOT EXISTS idx_wms_downtime_start ON public.wms_downtime_logs(started_at);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wms_job_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_job_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_dpr_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_downtime_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wms_job_cards', 'wms_job_operations', 'wms_dpr_entries', 'wms_downtime_logs'
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
