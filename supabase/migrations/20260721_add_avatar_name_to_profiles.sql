-- Add avatar_name to profiles so avatar persistence works
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_name text;

COMMENT ON COLUMN public.profiles.avatar_name IS 'Display initials / avatar name persisted from device settings';
