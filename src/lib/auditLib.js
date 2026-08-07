import { supabase } from './supabase'

export async function logWmsAudit({
  action,
  module,
  summary,
  entityTable = null,
  entityId = null,
  metadata = null,
  userEmail = null,
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const row = {
    user_id: user.id,
    user_email: userEmail || user.email || null,
    action,
    module,
    entity_table: entityTable,
    entity_id: entityId != null ? String(entityId) : null,
    summary,
    metadata,
  }
  const { error } = await supabase.from('wms_audit_log').insert(row)
  if (error) console.warn('wms_audit_log insert failed:', error.message)
}

export async function listAuditLog({ limit = 200, module = '' } = {}) {
  let q = supabase
    .from('wms_audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (module) q = q.eq('module', module)
  const { data, error } = await q
  if (error) throw error
  return data || []
}
