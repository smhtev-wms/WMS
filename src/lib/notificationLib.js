import { supabase } from './supabase'
import { daysUntil } from './phase3Constants'

/** UI grouping for notification filters (Commercial vs shop/ops). */
export const NOTIFICATION_CATEGORY = {
  tender_due: 'commercial',
  receivable_overdue: 'commercial',
  cal_overdue: 'operations',
  pm_overdue: 'operations',
}

export function notificationCategory(sourceType) {
  return NOTIFICATION_CATEGORY[sourceType] || 'operations'
}

export async function listNotifications({ unreadOnly = false } = {}) {
  let q = supabase
    .from('wms_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (unreadOnly) q = q.eq('is_read', false)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function countUnreadNotifications() {
  const { count, error } = await supabase
    .from('wms_notifications')
    .select('*', { count: 'exact', head: true })
    .eq('is_read', false)
  if (error) return 0
  return count ?? 0
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from('wms_notifications').update({ is_read: true }).eq('id', id)
  if (error) throw error
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.from('wms_notifications').update({ is_read: true }).eq('is_read', false)
  if (error) throw error
}

async function upsertSystemNotification(payload) {
  const { data: existing } = await supabase
    .from('wms_notifications')
    .select('id')
    .eq('source_type', payload.source_type)
    .eq('source_id', payload.source_id)
    .maybeSingle()

  if (existing?.id) {
    const { error } = await supabase.from('wms_notifications').update({
      title: payload.title,
      body: payload.body,
      severity: payload.severity,
      link_path: payload.link_path,
      is_read: false,
    }).eq('id', existing.id)
    if (error) throw error
    return
  }
  const { error } = await supabase.from('wms_notifications').insert({
    user_id: null,
    ...payload,
    is_read: false,
  })
  if (error) throw error
}

export async function refreshSystemNotifications() {
  const today = new Date().toISOString().slice(0, 10)
  let upserts = 0

  const { data: tenders } = await supabase
    .from('wms_tenders')
    .select('id, tender_no, title, submission_due')
    .eq('status', 'open')
  for (const t of tenders || []) {
    const d = daysUntil(t.submission_due)
    if (d != null && d >= 0 && d <= 14) {
      await upsertSystemNotification({
        title: `Tender due: ${t.tender_no}`,
        body: `${t.title} — submit by ${t.submission_due}`,
        severity: d <= 3 ? 'urgent' : 'warning',
        link_path: '/commercial/tenders',
        source_type: 'tender_due',
        source_id: t.id,
      })
      upserts += 1
    }
  }

  const { data: tools } = await supabase
    .from('wms_tooling')
    .select('id, tool_code, name, next_calibration_date')
    .eq('is_active', true)
    .eq('calibration_required', true)
  for (const t of tools || []) {
    const d = daysUntil(t.next_calibration_date)
    if (d != null && d < 0) {
      await upsertSystemNotification({
        title: `Calibration overdue: ${t.tool_code}`,
        body: t.name,
        severity: 'urgent',
        link_path: '/masters/tooling',
        source_type: 'cal_overdue',
        source_id: t.id,
      })
      upserts += 1
    }
  }

  const { data: plans } = await supabase
    .from('wms_maintenance_plans')
    .select('id, plan_code, title, next_due_date')
    .eq('is_active', true)
  for (const p of plans || []) {
    const d = daysUntil(p.next_due_date)
    if (d != null && d < 0) {
      await upsertSystemNotification({
        title: `PM overdue: ${p.plan_code}`,
        body: p.title,
        severity: 'warning',
        link_path: '/maintenance',
        source_type: 'pm_overdue',
        source_id: p.id,
      })
      upserts += 1
    }
  }

  const { data: recv } = await supabase
    .from('wms_customer_receivables')
    .select('id, invoice_no, due_date, gross_amount, amount_received, status')
    .in('status', ['open', 'partial'])
  for (const r of recv || []) {
    const d = daysUntil(r.due_date)
    if (d != null && d < 0) {
      const out = Number(r.gross_amount) - Number(r.amount_received)
      await upsertSystemNotification({
        title: `Invoice overdue: ${r.invoice_no}`,
        body: `Outstanding ₹${out.toLocaleString('en-IN')} — due ${r.due_date}`,
        severity: 'urgent',
        link_path: '/insights/receivables',
        source_type: 'receivable_overdue',
        source_id: r.id,
      })
      upserts += 1
    }
  }

  return { upserts, refreshed_at: today }
}
