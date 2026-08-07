import { supabase } from './supabase'
import { isUuid } from './ordersLib'

export const ATTENDANCE_STATUSES = [
  { value: 'present', label: 'Present' },
  { value: 'half_day', label: 'Half day' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
  { value: 'holiday', label: 'Holiday' },
]

export async function listAttendance(fromDate, toDate) {
  let q = supabase.from('wms_attendance').select('*').order('work_date', { ascending: false })
  if (fromDate) q = q.gte('work_date', fromDate)
  if (toDate) q = q.lte('work_date', toDate)
  const { data, error } = await q.limit(500)
  if (error) throw error
  const rows = data || []
  const opIds = [...new Set(rows.map(r => r.operator_id))]
  const { data: ops } = opIds.length
    ? await supabase.from('wms_operators').select('id, employee_code, full_name').in('id', opIds)
    : { data: [] }
  const opById = Object.fromEntries((ops || []).map(o => [o.id, o]))
  return rows.map(r => ({ ...r, operator: opById[r.operator_id] }))
}

export async function saveAttendance(payload, id) {
  const row = {
    operator_id: payload.operator_id,
    work_date: payload.work_date,
    status: payload.status,
    hours_worked: Number(payload.hours_worked) ?? 8,
    notes: payload.notes || null,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('wms_attendance').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_attendance').upsert(row, { onConflict: 'operator_id,work_date' }).select('*').single()
  if (error) throw error
  return data
}

export async function attendanceSummaryForDate(workDate) {
  const { data: ops, error: oe } = await supabase.from('wms_operators').select('id').eq('is_active', true)
  if (oe) throw oe
  const activeCount = (ops || []).length
  if (!activeCount) return { active_operators: 0, marked: 0, present: 0, pct: 0 }

  const { data: marks, error } = await supabase
    .from('wms_attendance')
    .select('status')
    .eq('work_date', workDate)
  if (error) throw error
  const present = (marks || []).filter(m => ['present', 'half_day'].includes(m.status)).length
  return {
    active_operators: activeCount,
    marked: (marks || []).length,
    present,
    pct: Math.round((present / activeCount) * 100),
  }
}

export async function updateOperatorHourlyRate(operatorId, hourlyRate) {
  if (!isUuid(operatorId)) throw new Error('Invalid operator.')
  const { error } = await supabase
    .from('wms_operators')
    .update({ hourly_rate: hourlyRate == null || hourlyRate === '' ? null : Number(hourlyRate), updated_at: new Date().toISOString() })
    .eq('id', operatorId)
  if (error) throw error
}
