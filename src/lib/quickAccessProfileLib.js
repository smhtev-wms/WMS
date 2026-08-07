import { supabase } from './supabase'

/** @typedef {{ version: number, groupOrder?: string[], groups: import('./quickAccessLayoutLib').QuickAccessGroup[], disabledPaths?: string[], disabledGroupIds?: string[], hiddenPaths?: string[] }} QuickAccessLayout */

function isMissingColumnError(error) {
  const msg = (error?.message || '').toLowerCase()
  return (
    msg.includes('wms_quick_access')
    || error?.code === '42703'
    || error?.code === 'PGRST204'
  )
}

/**
 * @returns {Promise<{ layout: QuickAccessLayout | null, error: Error | null, missingColumn?: boolean }>}
 */
export async function loadQuickAccessFromProfile(userId) {
  if (!userId) return { layout: null, error: null }
  const { data, error } = await supabase
    .from('profiles')
    .select('wms_quick_access')
    .eq('id', userId)
    .maybeSingle()
  if (error) {
    return {
      layout: null,
      error,
      missingColumn: isMissingColumnError(error),
    }
  }
  return { layout: data?.wms_quick_access ?? null, error: null }
}

/**
 * @returns {Promise<{ ok: boolean, layout?: QuickAccessLayout | null, error?: Error | null, missingColumn?: boolean }>}
 */
export async function saveQuickAccessToProfile(userId, layout) {
  if (!userId) {
    return { ok: false, error: new Error('Not signed in') }
  }
  const { data, error } = await supabase
    .from('profiles')
    .update({
      wms_quick_access: layout,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select('wms_quick_access')
    .maybeSingle()

  if (error) {
    return { ok: false, error, missingColumn: isMissingColumnError(error) }
  }
  if (!data) {
    return {
      ok: false,
      error: new Error('Profile row was not updated. Check that your user has a profiles row and RLS allows update.'),
    }
  }
  return { ok: true, layout: data.wms_quick_access ?? layout }
}
