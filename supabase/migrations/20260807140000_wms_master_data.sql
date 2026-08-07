-- WMS Phase 1 — Master data tables (BHEL machine shop)

CREATE OR REPLACE FUNCTION public.wms_is_ops_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin', 'admin1')
  );
$$;

CREATE OR REPLACE FUNCTION public.wms_can_read_masters()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('super_admin', 'admin', 'admin1', 'user', 'demo')
  );
$$;

-- ── 1.1 Customers ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_customers (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code     text NOT NULL,
  name              text NOT NULL,
  customer_type     text NOT NULL DEFAULT 'allied'
                    CHECK (customer_type IN ('bhel', 'allied', 'other')),
  bhel_vendor_code  text,
  address           text,
  city              text,
  state             text,
  pincode           text,
  gstin             text,
  contact_name      text,
  phone             text,
  email             text,
  notes             text,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_customers_code_unique UNIQUE (customer_code)
);

-- ── 1.2 Items / parts ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code           text NOT NULL,
  drawing_number      text,
  revision            text NOT NULL DEFAULT '0',
  description         text NOT NULL,
  material_spec       text,
  uom                 text NOT NULL DEFAULT 'NOS',
  default_customer_id uuid REFERENCES public.wms_customers(id) ON DELETE SET NULL,
  notes               text,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_items_code_unique UNIQUE (item_code)
);

CREATE INDEX IF NOT EXISTS idx_wms_items_customer ON public.wms_items(default_customer_id);

-- ── 1.3 Materials ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_materials (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_code   text NOT NULL,
  name            text NOT NULL,
  grade           text,
  specification   text,
  uom             text NOT NULL DEFAULT 'KG',
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_materials_code_unique UNIQUE (material_code)
);

-- ── 1.4 Machines ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_machines (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_code          text NOT NULL,
  name                  text NOT NULL,
  machine_type          text NOT NULL DEFAULT 'other'
                        CHECK (machine_type IN ('lathe', 'cnc', 'mill', 'grind', 'drill', 'other')),
  location              text,
  capacity_description  text,
  notes                 text,
  is_active             boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_machines_code_unique UNIQUE (machine_code)
);

-- ── 1.5 Operators ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_operators (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code   text NOT NULL,
  full_name       text NOT NULL,
  designation     text,
  skill_level     text,
  phone           text,
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_operators_code_unique UNIQUE (employee_code)
);

-- ── 1.6 Subcontractors ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wms_subcontractors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_code     text NOT NULL,
  name            text NOT NULL,
  process_type    text,
  contact_name    text,
  phone           text,
  email           text,
  address         text,
  notes           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wms_subcontractors_code_unique UNIQUE (vendor_code)
);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.wms_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wms_subcontractors ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'wms_customers', 'wms_items', 'wms_materials',
    'wms_machines', 'wms_operators', 'wms_subcontractors'
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
