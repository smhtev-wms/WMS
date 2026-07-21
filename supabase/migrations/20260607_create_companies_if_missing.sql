-- Ensure the companies table exists for the current WMS schema.
-- If the legacy churches table exists, rename it. Otherwise create companies directly.
-- Also add any missing columns required by the current WMS app.

CREATE OR REPLACE FUNCTION public.get_my_role()
 RETURNS text
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
AS $function$
  select role from profiles where id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.sync_companies_name_columns()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.company_name IS NULL THEN
    NEW.company_name := NEW.church_name;
  END IF;

  IF NEW.church_name IS NULL THEN
    NEW.church_name := NEW.company_name;
  END IF;

  IF NEW.company_name <> NEW.church_name THEN
    NEW.church_name := NEW.company_name;
  END IF;

  RETURN NEW;
END;
$function$
;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'companies'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'churches'
    ) THEN
      ALTER TABLE public.churches RENAME TO companies;
    ELSE
      CREATE TABLE public.companies (
        id uuid not null default gen_random_uuid(),
        company_name text not null default ''::text,
        church_name text not null default ''::text,
        church_code text,
        diocese text,
        denomination text,
        pastor_name text,
        pastor_contact text,
        pastor_email text,
        address text,
        city text,
        state text,
        pincode text,
        email text,
        logo_url text,
        diocese_logo_url text,
        treasurer_seal_url text,
        auth_code text,
        license_ok_ts timestamp with time zone,
        whatsapp_number text,
        whatsapp_url text,
        instance_id text,
        access_token text,
        whatsapp_api_type text not null default 'soft7',
        official_phone_number_id text,
        official_bearer_token text,
        presbyter_name text,
        presbyter_whatsapp text,
        secretary_name text,
        secretary_whatsapp text,
        treasurer_name text,
        treasurer_whatsapp text,
        admin1_name text,
        admin1_whatsapp text,
        receipt_date_mode text not null default 'today',
        whatsapp_receipt_mode text not null default 'instant',
        upi_id text,
        site_url text,
        is_active boolean not null default true,
        accounting_enabled boolean not null default false,
        simple_accounting_enabled boolean not null default true,
        accounting_country text not null default 'India',
        accounting_currency text not null default '₹',
        accounting_number_format text not null default 'indian',
        accounting_date_format text not null default 'DD-MM-YYYY',
        accounting_report_subtitle text,
        accounting_default_voucher text not null default 'Receipt',
        accounting_auto_post boolean not null default false,
        accounting_prefix_receipt text not null default 'RV',
        accounting_prefix_payment text not null default 'PV',
        accounting_prefix_journal text not null default 'JV',
        accounting_prefix_contra text not null default 'CT',
        accounting_prefix_opening text not null default 'OB',
        accounting_default_cash_id uuid,
        accounting_default_bank_id uuid,
        accounting_period_lock_date date,
        accounting_opening_date date,
        accounting_auto_post_receipts boolean not null default false,
        accounting_entry_system text not null default 'double',
        accounting_fiscal_month integer not null default 4,
        accounting_entry_system_locked boolean not null default false,
        accounting_custom_vouchers jsonb not null default '[]'::jsonb,
        simple_accounting_currency text not null default '₹',
        simple_accounting_fiscal_month integer not null default 4,
        simple_accounting_report_title text,
        simple_accounting_default_account uuid,
        created_at timestamp with time zone not null default now(),
        updated_at timestamp with time zone not null default now(),
        primary key (id)
      );
      ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'companies_insert') THEN
        CREATE POLICY companies_insert ON public.companies AS PERMISSIVE FOR INSERT TO public WITH CHECK ((public.get_my_role() = 'super_admin'::text));
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'companies_select') THEN
        CREATE POLICY companies_select ON public.companies AS PERMISSIVE FOR SELECT TO public USING (true);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'companies_update') THEN
        CREATE POLICY companies_update ON public.companies AS PERMISSIVE FOR UPDATE TO public USING ((public.get_my_role() = 'super_admin'::text));
      END IF;
      GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.companies TO anon;
      GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.companies TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER, TRUNCATE, REFERENCES ON public.companies TO service_role;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'companies'
  ) THEN
      IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'companies'
        AND column_name = 'church_name'
    ) THEN
      ALTER TABLE public.companies ADD COLUMN church_name text not null default ''::text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'companies'
        AND column_name = 'company_name'
    ) THEN
      ALTER TABLE public.companies ADD COLUMN company_name text not null default ''::text;
    END IF;

    UPDATE public.companies
    SET company_name = church_name
    WHERE company_name = '' AND church_name <> '';

    UPDATE public.companies
    SET church_name = company_name
    WHERE church_name = '' AND company_name <> '';

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'companies_sync_name_trigger'
        AND tgrelid = 'public.companies'::regclass
    ) THEN
      CREATE TRIGGER companies_sync_name_trigger
      BEFORE INSERT OR UPDATE ON public.companies
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_companies_name_columns();
    END IF;

    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS email text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS diocese_logo_url text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS treasurer_seal_url text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS license_ok_ts timestamp with time zone;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS whatsapp_number text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS whatsapp_url text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS instance_id text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS access_token text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS whatsapp_api_type text not null default 'soft7';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS official_phone_number_id text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS official_bearer_token text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS presbyter_name text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS presbyter_whatsapp text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS secretary_name text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS secretary_whatsapp text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS treasurer_name text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS treasurer_whatsapp text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS admin1_name text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS admin1_whatsapp text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS receipt_date_mode text not null default 'today';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS whatsapp_receipt_mode text not null default 'instant';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS upi_id text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS site_url text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_enabled boolean not null default false;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS simple_accounting_enabled boolean not null default true;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_country text not null default 'India';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_currency text not null default '₹';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_number_format text not null default 'indian';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_date_format text not null default 'DD-MM-YYYY';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_report_subtitle text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_default_voucher text not null default 'Receipt';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_auto_post boolean not null default false;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_prefix_receipt text not null default 'RV';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_prefix_payment text not null default 'PV';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_prefix_journal text not null default 'JV';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_prefix_contra text not null default 'CT';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_prefix_opening text not null default 'OB';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_default_cash_id uuid;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_default_bank_id uuid;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_period_lock_date date;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_opening_date date;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_auto_post_receipts boolean not null default false;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_entry_system text not null default 'double';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_fiscal_month integer not null default 4;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_entry_system_locked boolean not null default false;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS accounting_custom_vouchers jsonb not null default '[]'::jsonb;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS simple_accounting_currency text not null default '₹';
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS simple_accounting_fiscal_month integer not null default 4;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS simple_accounting_report_title text;
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS simple_accounting_default_account uuid;
  END IF;
END
$$;
