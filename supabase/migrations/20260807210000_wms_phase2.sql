-- WMS Phase 2 — Quality, dispatch, drawing revision

-- ── Quality inspections ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_inspections (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_no       text NOT NULL,
  job_card_id         uuid NOT NULL REFERENCES public.wms_job_cards(id) ON DELETE RESTRICT,
  job_operation_id    uuid REFERENCES public.wms_job_operations(id) ON DELETE SET NULL,
  inspection_date     date NOT NULL DEFAULT CURRENT_DATE,
  inspector_name      text,
  result              text NOT NULL DEFAULT 'pass'
                      CHECK (result IN ('pass', 'fail', 'conditional')),
  qty_inspected       numeric(14, 3) NOT NULL DEFAULT 0,
  qty_accepted        numeric(14, 3) NOT NULL DEFAULT 0,
  qty_rejected        numeric(14, 3) NOT NULL DEFAULT 0,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_inspections_no_unique UNIQUE (inspection_no)
);

CREATE INDEX IF NOT EXISTS idx_wms_inspections_job ON public.wms_inspections(job_card_id);

CREATE TABLE IF NOT EXISTS public.wms_ncr (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ncr_no          text NOT NULL,
  inspection_id   uuid REFERENCES public.wms_inspections(id) ON DELETE SET NULL,
  job_card_id     uuid NOT NULL REFERENCES public.wms_job_cards(id) ON DELETE RESTRICT,
  raised_date     date NOT NULL DEFAULT CURRENT_DATE,
  description     text NOT NULL,
  disposition     text NOT NULL DEFAULT 'pending'
                  CHECK (disposition IN ('pending', 'rework', 'scrap', 'use_as_is', 'return_vendor')),
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'closed')),
  closed_date     date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_ncr_no_unique UNIQUE (ncr_no)
);

CREATE INDEX IF NOT EXISTS idx_wms_ncr_job ON public.wms_ncr(job_card_id);

-- ── Dispatch ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_dispatches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_no     text NOT NULL,
  po_id           uuid NOT NULL REFERENCES public.wms_purchase_orders(id) ON DELETE RESTRICT,
  customer_id     uuid NOT NULL REFERENCES public.wms_customers(id) ON DELETE RESTRICT,
  dispatch_date   date NOT NULL DEFAULT CURRENT_DATE,
  vehicle_no      text,
  lr_number       text,
  transporter     text,
  destination     text,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'dispatched', 'cancelled')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_dispatches_no_unique UNIQUE (dispatch_no)
);

CREATE INDEX IF NOT EXISTS idx_wms_dispatches_po ON public.wms_dispatches(po_id);

CREATE TABLE IF NOT EXISTS public.wms_dispatch_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id     uuid NOT NULL REFERENCES public.wms_dispatches(id) ON DELETE CASCADE,
  po_line_id      uuid NOT NULL REFERENCES public.wms_po_lines(id) ON DELETE RESTRICT,
  qty_dispatched  numeric(14, 3) NOT NULL CHECK (qty_dispatched > 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_dispatch_lines_unique UNIQUE (dispatch_id, po_line_id)
);

CREATE INDEX IF NOT EXISTS idx_wms_dispatch_lines_po_line ON public.wms_dispatch_lines(po_line_id);

-- ── Drawing revision history ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_drawing_revisions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id           uuid NOT NULL REFERENCES public.wms_items(id) ON DELETE RESTRICT,
  previous_revision text NOT NULL,
  new_revision      text NOT NULL,
  effective_date    date NOT NULL DEFAULT CURRENT_DATE,
  change_reason     text NOT NULL,
  customer_ref      text,
  apply_to_item     boolean NOT NULL DEFAULT true,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wms_drawing_rev_item ON public.wms_drawing_revisions(item_id);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wms_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_ncr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_dispatch_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_drawing_revisions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wms_inspections', 'wms_ncr', 'wms_dispatches', 'wms_dispatch_lines', 'wms_drawing_revisions'
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
