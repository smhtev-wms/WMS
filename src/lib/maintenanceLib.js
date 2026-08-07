import { supabase } from './supabase'
import { isUuid } from './ordersLib'
import { nextDocNo } from './orderConstants'
import { addDays } from './phase3Constants'

export async function suggestPlanCode() {
  const { data } = await supabase.from('wms_maintenance_plans').select('plan_code')
  return nextDocNo('PM', data || [])
}

export async function listMaintenancePlans() {
  const { data, error } = await supabase.from('wms_maintenance_plans').select('*').order('next_due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  const rows = data || []
  const machineIds = [...new Set(rows.map(r => r.machine_id))]
  const { data: machines } = await supabase.from('wms_machines').select('id, machine_code, name').in('id', machineIds)
  const machineById = Object.fromEntries((machines || []).map(m => [m.id, m]))
  return rows.map(r => ({ ...r, machine: machineById[r.machine_id] }))
}

export async function saveMaintenancePlan(payload, id) {
  const freq = Number(payload.frequency_days)
  const lastDone = payload.last_done_date || null
  const row = {
    plan_code: payload.plan_code,
    machine_id: payload.machine_id,
    title: payload.title,
    frequency_days: freq,
    last_done_date: lastDone,
    next_due_date: lastDone ? addDays(lastDone, freq) : (payload.next_due_date || null),
    notes: payload.notes || null,
    is_active: payload.is_active !== false,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('wms_maintenance_plans').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_maintenance_plans').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function setMaintenancePlanActive(id, isActive) {
  const { error } = await supabase.from('wms_maintenance_plans').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

export async function listMaintenanceLogs() {
  const { data, error } = await supabase.from('wms_maintenance_logs').select('*').order('work_date', { ascending: false }).limit(100)
  if (error) throw error
  const rows = data || []
  const machineIds = [...new Set(rows.map(r => r.machine_id))]
  const { data: machines } = await supabase.from('wms_machines').select('id, machine_code, name').in('id', machineIds)
  const machineById = Object.fromEntries((machines || []).map(m => [m.id, m]))
  return rows.map(r => ({ ...r, machine: machineById[r.machine_id] }))
}

export async function saveMaintenanceLog(payload) {
  const workDate = payload.work_date
  const planId = isUuid(payload.plan_id) ? payload.plan_id : null
  const row = {
    plan_id: planId,
    machine_id: payload.machine_id,
    work_date: workDate,
    work_done: payload.work_done,
    downtime_hours: payload.downtime_hours === '' || payload.downtime_hours == null ? null : Number(payload.downtime_hours),
    performed_by: payload.performed_by || null,
    notes: payload.notes || null,
  }
  const { data, error } = await supabase.from('wms_maintenance_logs').insert(row).select('*').single()
  if (error) throw error

  if (planId) {
    const { data: plan } = await supabase.from('wms_maintenance_plans').select('frequency_days').eq('id', planId).single()
    if (plan?.frequency_days) {
      await supabase.from('wms_maintenance_plans').update({
        last_done_date: workDate,
        next_due_date: addDays(workDate, plan.frequency_days),
        updated_at: new Date().toISOString(),
      }).eq('id', planId)
    }
  }
  return data
}
