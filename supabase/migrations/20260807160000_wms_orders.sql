-- WMS Sprint B — Order management (enquiries, POs, lines, attachments, amendments)

-- ── Enquiries / RFQ ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_enquiries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_no      text NOT NULL,
  customer_id     uuid NOT NULL REFERENCES public.wms_customers(id) ON DELETE RESTRICT,
  enquiry_date    date NOT NULL DEFAULT CURRENT_DATE,
  response_due    date,
  status          text NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'quoted', 'won', 'lost', 'cancelled')),
  subject         text NOT NULL DEFAULT '',
  reference       text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_enquiries_no_unique UNIQUE (enquiry_no)
);

CREATE INDEX IF NOT EXISTS idx_wms_enquiries_customer ON public.wms_enquiries(customer_id);
CREATE INDEX IF NOT EXISTS idx_wms_enquiries_status ON public.wms_enquiries(status);

-- ── Purchase orders ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_purchase_orders (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number         text NOT NULL,
  customer_id       uuid NOT NULL REFERENCES public.wms_customers(id) ON DELETE RESTRICT,
  enquiry_id        uuid REFERENCES public.wms_enquiries(id) ON DELETE SET NULL,
  customer_po_ref   text,
  po_date           date NOT NULL DEFAULT CURRENT_DATE,
  delivery_date     date,
  status            text NOT NULL DEFAULT 'draft'
                    CHECK (status IN (
                      'draft', 'released', 'in_production', 'inspection',
                      'ready_dispatch', 'dispatched', 'closed', 'cancelled'
                    )),
  currency          text NOT NULL DEFAULT 'INR',
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_po_number_unique UNIQUE (po_number)
);

CREATE INDEX IF NOT EXISTS idx_wms_po_customer ON public.wms_purchase_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_wms_po_status ON public.wms_purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_wms_po_delivery ON public.wms_purchase_orders(delivery_date);

-- ── PO line items ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_po_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           uuid NOT NULL REFERENCES public.wms_purchase_orders(id) ON DELETE CASCADE,
  line_no         int NOT NULL,
  item_id         uuid REFERENCES public.wms_items(id) ON DELETE SET NULL,
  description     text NOT NULL,
  drawing_number  text,
  revision        text,
  qty             numeric(14, 3) NOT NULL DEFAULT 1 CHECK (qty > 0),
  uom             text NOT NULL DEFAULT 'NOS',
  unit_rate       numeric(14, 2),
  line_delivery   date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_po_lines_po_line_unique UNIQUE (po_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_wms_po_lines_po ON public.wms_po_lines(po_id);

-- ── PO file attachments (drawings / specs) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_po_attachments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id           uuid NOT NULL REFERENCES public.wms_purchase_orders(id) ON DELETE CASCADE,
  file_name       text NOT NULL,
  storage_path    text NOT NULL,
  mime_type       text,
  file_size       bigint,
  uploaded_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wms_po_attachments_po ON public.wms_po_attachments(po_id);

-- ── Amendment history ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_po_amendments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id             uuid NOT NULL REFERENCES public.wms_purchase_orders(id) ON DELETE CASCADE,
  amendment_no      int NOT NULL,
  reason            text NOT NULL,
  snapshot_before   jsonb NOT NULL,
  snapshot_after    jsonb NOT NULL,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_po_amendments_unique UNIQUE (po_id, amendment_no)
);

CREATE INDEX IF NOT EXISTS idx_wms_po_amendments_po ON public.wms_po_amendments(po_id);

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.wms_enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_po_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_po_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_po_amendments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wms_enquiries', 'wms_purchase_orders', 'wms_po_lines',
    'wms_po_attachments', 'wms_po_amendments'
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

-- ── Storage bucket for PO attachments ──────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wms-po-attachments',
  'wms-po-attachments',
  false,
  20971520,
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "wms_po_attachments_storage_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'wms-po-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "wms_po_attachments_storage_select"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'wms-po-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "wms_po_attachments_storage_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'wms-po-attachments');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
