import { supabase } from './supabase'

/** @typedef {{ version: number, groupOrder?: string[], groups: import('./quickAccessLayoutLib').QuickAccessGroup[], disabledPaths?: string[], disabledGroupIds?: string[], hiddenPaths?: string[] }} QuickAccessLayout */

export async function loadQuickAccessFromProfile(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('wms_quick_access')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data?.wms_quick_access ?? null
}

export async function saveQuickAccessToProfile(userId, layout) {
  if (!userId) return
  const { error } = await supabase
    .from('profiles')
    .update({
      wms_quick_access: layout,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) throw error
}
