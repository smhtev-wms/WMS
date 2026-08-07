import { supabase } from './supabase'
import { isUuid } from './ordersLib'
import { addDays } from './phase3Constants'

function computeNextCalibration(lastDate, intervalDays, required) {
  if (!required || !lastDate || !intervalDays) return null
  return addDays(lastDate, intervalDays)
}

export async function listTooling() {
  const { data, error } = await supabase.from('wms_tooling').select('*').order('tool_code')
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []
  const machineIds = [...new Set(rows.map(r => r.machine_id).filter(isUuid))]
  let machineById = {}
  if (machineIds.length) {
    const { data: machines } = await supabase.from('wms_machines').select('id, machine_code, name').in('id', machineIds)
    machineById = Object.fromEntries((machines || []).map(m => [m.id, m]))
  }
  return rows.map(r => ({ ...r, machine: machineById[r.machine_id] }))
}

export async function saveTooling(payload, id) {
  const required = Boolean(payload.calibration_required)
  const interval = payload.calibration_interval_days ? Number(payload.calibration_interval_days) : null
  const lastCal = payload.last_calibration_date || null
  const row = {
    tool_code: payload.tool_code,
    name: payload.name,
    tool_type: payload.tool_type,
    location: payload.location || null,
    machine_id: isUuid(payload.machine_id) ? payload.machine_id : null,
    calibration_required: required,
    calibration_interval_days: required ? interval : null,
    last_calibration_date: required ? lastCal : null,
    next_calibration_date: required ? computeNextCalibration(lastCal, interval, required) : null,
    notes: payload.notes || null,
    is_active: payload.is_active !== false,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('wms_tooling').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_tooling').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function setToolingActive(id, isActive) {
  const { error } = await supabase.from('wms_tooling').update({ is_active: isActive, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
