-- Per-user Quick Access layout (groups, order, hidden modules)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS wms_quick_access jsonb;

COMMENT ON COLUMN public.profiles.wms_quick_access IS
  'WMS Quick Access: { version, groupOrder?, groups[], hiddenPaths[] }';
