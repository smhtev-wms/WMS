import { supabase } from './supabase'
import { listReceivables, receivablesAgeingSummary } from './receivablesLib'
import { attendanceSummaryForDate } from './hrLib'
import { daysUntil } from './phase3Constants'

export async function getExecutiveKpis() {
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = `${today.slice(0, 7)}-01`

  const [
    { count: poCount },
    { count: jobOpen },
    { data: pos },
    { count: ncrOpen },
    { data: tenders },
    { data: tooling },
    { data: pmPlans },
    receivables,
    attendance,
    { count: dispatchMonth },
  ] = await Promise.all([
    supabase.from('wms_purchase_orders').select('*', { count: 'exact', head: true }).in('status', ['draft', 'released', 'in_production', 'inspection', 'ready_dispatch', 'dispatched']),
    supabase.from('wms_job_cards').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress', 'inspection']),
    supabase.from('wms_purchase_orders').select('id, delivery_date, status').not('status', 'in', '("closed","cancelled")'),
    supabase.from('wms_ncr').select('*', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('wms_tenders').select('submission_due, status').eq('status', 'open'),
    supabase.from('wms_tooling').select('next_calibration_date, calibration_required').eq('is_active', true).eq('calibration_required', true),
    supabase.from('wms_maintenance_plans').select('next_due_date').eq('is_active', true),
    listReceivables(),
    attendanceSummaryForDate(today),
    supabase.from('wms_dispatches').select('*', { count: 'exact', head: true }).eq('status', 'dispatched').gte('dispatch_date', monthStart),
  ])

  const overduePo = (pos || []).filter(p => p.delivery_date && p.delivery_date < today).length
  const tendersDueSoon = (tenders || []).filter(t => {
    const d = daysUntil(t.submission_due)
    return d != null && d >= 0 && d <= 14
  }).length
  const calOverdue = (tooling || []).filter(t => {
    const d = daysUntil(t.next_calibration_date)
    return d != null && d < 0
  }).length
  const pmOverdue = (pmPlans || []).filter(p => {
    const d = daysUntil(p.next_due_date)
    return d != null && d < 0
  }).length

  const ageing = receivablesAgeingSummary(receivables)

  return {
    open_pos: poCount ?? 0,
    jobs_in_progress: jobOpen ?? 0,
    overdue_po_deliveries: overduePo,
    open_ncrs: ncrOpen ?? 0,
    tenders_due_14d: tendersDueSoon,
    calibration_overdue: calOverdue,
    pm_overdue: pmOverdue,
    receivables_outstanding: ageing.total_outstanding,
    receivables_overdue: ageing.overdue,
    dispatches_this_month: dispatchMonth ?? 0,
    attendance_today_pct: attendance.pct,
    attendance_present: attendance.present,
    attendance_active_ops: attendance.active_operators,
  }
}
