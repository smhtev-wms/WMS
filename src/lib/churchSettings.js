import { supabase } from './supabase'

const STORAGE_KEY = 'wms_local_church_settings_v1'

export function readLocalChurchSettings() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function writeLocalChurchSettings(settings) {
  if (typeof window === 'undefined') return settings
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {}
  return settings
}

export async function loadChurchSettings() {
  try {
    const { data, error } = await supabase.from('companies').select('*').limit(1).maybeSingle()
    if (!error && data) {
      const normalized = {
        ...data,
        church_name: data.church_name || data.company_name || ''
      }
      writeLocalChurchSettings(normalized)
      return { data: normalized, error: null, source: 'remote' }
    }
  } catch (error) {
    console.warn('Falling back to local church settings:', error)
  }

  const localData = readLocalChurchSettings()
  return { data: localData, error: null, source: 'local' }
}

export async function patchChurchSettings(updates, churchId = null) {
  const current = readLocalChurchSettings() || {}
  const next = { ...current, ...updates, ...(churchId ? { id: churchId } : {}) }
  writeLocalChurchSettings(next)

  const targetId = churchId || current?.id
  if (!targetId) {
    return { data: next, error: null, source: 'local' }
  }

  try {
    const { error } = await supabase.from('companies').update(updates).eq('id', targetId)
    if (!error) return { data: next, error: null, source: 'remote' }
  } catch (error) {
    console.warn('Remote church settings update failed, using local fallback:', error)
  }

  return { data: next, error: null, source: 'local' }
}

export function getChurchFlags(data = null) {
  const church = data || readLocalChurchSettings() || {}
  return {
    accountingEnabled: !!church.accounting_enabled,
    simpleAccountingEnabled: !!church.simple_accounting_enabled,
  }
}
