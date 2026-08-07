-- WMS Sprint E — Basic stores (RM inward with heat/batch, material issue)

CREATE TABLE IF NOT EXISTS public.wms_rm_inward (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inward_no         text NOT NULL,
  material_id       uuid NOT NULL REFERENCES public.wms_materials(id) ON DELETE RESTRICT,
  heat_number       text,
  batch_number      text,
  supplier_name     text,
  invoice_ref       text,
  qty_received      numeric(14, 3) NOT NULL CHECK (qty_received > 0),
  qty_balance       numeric(14, 3) NOT NULL CHECK (qty_balance >= 0),
  uom               text NOT NULL DEFAULT 'KG',
  received_date     date NOT NULL DEFAULT CURRENT_DATE,
  storage_location  text,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_rm_inward_no_unique UNIQUE (inward_no),
  CONSTRAINT wms_rm_inward_balance_lte_received CHECK (qty_balance <= qty_received)
);

CREATE INDEX IF NOT EXISTS idx_wms_rm_inward_material ON public.wms_rm_inward(material_id);
CREATE INDEX IF NOT EXISTS idx_wms_rm_inward_heat ON public.wms_rm_inward(heat_number);
CREATE INDEX IF NOT EXISTS idx_wms_rm_inward_received ON public.wms_rm_inward(received_date);

CREATE TABLE IF NOT EXISTS public.wms_material_issues (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_no        text NOT NULL,
  inward_id       uuid NOT NULL REFERENCES public.wms_rm_inward(id) ON DELETE RESTRICT,
  material_id     uuid NOT NULL REFERENCES public.wms_materials(id) ON DELETE RESTRICT,
  job_card_id     uuid REFERENCES public.wms_job_cards(id) ON DELETE SET NULL,
  po_line_id      uuid REFERENCES public.wms_po_lines(id) ON DELETE SET NULL,
  qty_issued      numeric(14, 3) NOT NULL CHECK (qty_issued > 0),
  uom             text NOT NULL DEFAULT 'KG',
  issued_date     date NOT NULL DEFAULT CURRENT_DATE,
  issued_to       text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_material_issues_no_unique UNIQUE (issue_no)
);

CREATE INDEX IF NOT EXISTS idx_wms_material_issues_inward ON public.wms_material_issues(inward_id);
CREATE INDEX IF NOT EXISTS idx_wms_material_issues_job ON public.wms_material_issues(job_card_id);
CREATE INDEX IF NOT EXISTS idx_wms_material_issues_date ON public.wms_material_issues(issued_date);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wms_rm_inward ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_material_issues ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wms_rm_inward', 'wms_material_issues']
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
