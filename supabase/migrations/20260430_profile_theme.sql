-- Add theme and font preference columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS theme text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS font text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_theme_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_theme_check
      CHECK (theme IS NULL OR theme IN ('royal', 'ocean', 'forest', 'crimson', 'midnight', 'slate', 'ember', 'cyan'));
  END IF;
END $$;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
