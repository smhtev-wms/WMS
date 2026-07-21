-- Rename the legacy churches table to companies for the WMS finance app.
-- This preserves the existing schema and permissions while aligning the database with current code.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    RAISE NOTICE 'Table public.companies already exists; skipping rename.';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'churches'
  ) THEN
    ALTER TABLE public.churches RENAME TO companies;

    IF EXISTS (
      SELECT 1 FROM pg_class
      WHERE relkind = 'i' AND relname = 'churches_pkey'
    ) THEN
      ALTER INDEX public.churches_pkey RENAME TO companies_pkey;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'churches_updated_at'
        AND tgrelid = 'public.companies'::regclass
    ) THEN
      ALTER TRIGGER churches_updated_at ON public.companies RENAME TO companies_updated_at;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_policy
      WHERE polname = 'churches_insert'
        AND polrelid = 'public.companies'::regclass
    ) THEN
      ALTER POLICY churches_insert ON public.companies RENAME TO companies_insert;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_policy
      WHERE polname = 'churches_select'
        AND polrelid = 'public.companies'::regclass
    ) THEN
      ALTER POLICY churches_select ON public.companies RENAME TO companies_select;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_policy
      WHERE polname = 'churches_update'
        AND polrelid = 'public.companies'::regclass
    ) THEN
      ALTER POLICY churches_update ON public.companies RENAME TO companies_update;
    END IF;
  ELSE
    RAISE NOTICE 'Neither public.churches nor public.companies exists; no rename performed.';
  END IF;
END
$$;
