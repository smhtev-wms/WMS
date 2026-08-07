-- WMS Sprint C — Planning (route sheets, machine schedule, production vs delivery)

-- ── Route / process sheets (per item revision) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_route_sheets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_code      text NOT NULL,
  item_id         uuid NOT NULL REFERENCES public.wms_items(id) ON DELETE RESTRICT,
  revision        text NOT NULL DEFAULT '0',
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'released', 'obsolete')),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_route_sheets_code_unique UNIQUE (sheet_code),
  CONSTRAINT wms_route_sheets_item_rev_unique UNIQUE (item_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_wms_route_sheets_item ON public.wms_route_sheets(item_id);

CREATE TABLE IF NOT EXISTS public.wms_route_operations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_sheet_id      uuid NOT NULL REFERENCES public.wms_route_sheets(id) ON DELETE CASCADE,
  op_seq              int NOT NULL,
  operation_name      text NOT NULL,
  machine_id          uuid REFERENCES public.wms_machines(id) ON DELETE SET NULL,
  subcontractor_id    uuid REFERENCES public.wms_subcontractors(id) ON DELETE SET NULL,
  setup_minutes       numeric(10, 2) NOT NULL DEFAULT 0,
  cycle_minutes       numeric(10, 4) NOT NULL DEFAULT 0,
  inspection_required boolean NOT NULL DEFAULT false,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_route_ops_seq_unique UNIQUE (route_sheet_id, op_seq)
);

CREATE INDEX IF NOT EXISTS idx_wms_route_ops_sheet ON public.wms_route_operations(route_sheet_id);

-- ── Machine scheduling (linked to PO line + optional route op) ─────────────────
CREATE TABLE IF NOT EXISTS public.wms_machine_schedule (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id          uuid NOT NULL REFERENCES public.wms_machines(id) ON DELETE RESTRICT,
  po_line_id          uuid NOT NULL REFERENCES public.wms_po_lines(id) ON DELETE CASCADE,
  route_operation_id  uuid REFERENCES public.wms_route_operations(id) ON DELETE SET NULL,
  planned_start       timestamptz NOT NULL,
  planned_end         timestamptz NOT NULL,
  status              text NOT NULL DEFAULT 'planned'
                      CHECK (status IN ('planned', 'in_progress', 'done', 'cancelled')),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_schedule_end_after_start CHECK (planned_end > planned_start)
);

CREATE INDEX IF NOT EXISTS idx_wms_schedule_machine ON public.wms_machine_schedule(machine_id);
CREATE INDEX IF NOT EXISTS idx_wms_schedule_po_line ON public.wms_machine_schedule(po_line_id);
CREATE INDEX IF NOT EXISTS idx_wms_schedule_start ON public.wms_machine_schedule(planned_start);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wms_route_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_route_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_machine_schedule ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['wms_route_sheets', 'wms_route_operations', 'wms_machine_schedule']
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
