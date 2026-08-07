import { supabase } from './supabase'
import { isUuid } from './ordersLib'
import { nextDocNo } from './orderConstants'

export async function suggestInspectionNo() {
  const { data } = await supabase.from('wms_inspections').select('inspection_no')
  return nextDocNo('QC', data || [])
}

export async function suggestNcrNo() {
  const { data } = await supabase.from('wms_ncr').select('ncr_no')
  return nextDocNo('NCR', data || [])
}

export async function listInspections() {
  const { data, error } = await supabase
    .from('wms_inspections')
    .select('*')
    .order('inspection_date', { ascending: false })
    .limit(200)
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []

  const jobIds = [...new Set(rows.map(r => r.job_card_id))]
  const { data: jobs } = await supabase.from('wms_job_cards').select('id, job_number').in('id', jobIds)
  const jobById = Object.fromEntries((jobs || []).map(j => [j.id, j]))
  return rows.map(r => ({ ...r, job: jobById[r.job_card_id] }))
}

export async function saveInspection(payload, id) {
  const row = {
    inspection_no: payload.inspection_no,
    job_card_id: payload.job_card_id,
    job_operation_id: isUuid(payload.job_operation_id) ? payload.job_operation_id : null,
    inspection_date: payload.inspection_date,
    inspector_name: payload.inspector_name || null,
    result: payload.result,
    qty_inspected: Number(payload.qty_inspected) || 0,
    qty_accepted: Number(payload.qty_accepted) || 0,
    qty_rejected: Number(payload.qty_rejected) || 0,
    notes: payload.notes || null,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('wms_inspections').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_inspections').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function listNcr() {
  const { data, error } = await supabase.from('wms_ncr').select('*').order('raised_date', { ascending: false }).limit(200)
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []
  const jobIds = [...new Set(rows.map(r => r.job_card_id))]
  const { data: jobs } = await supabase.from('wms_job_cards').select('id, job_number').in('id', jobIds)
  const jobById = Object.fromEntries((jobs || []).map(j => [j.id, j]))
  return rows.map(r => ({ ...r, job: jobById[r.job_card_id] }))
}

export async function saveNcr(payload, id) {
  const row = {
    ncr_no: payload.ncr_no,
    inspection_id: isUuid(payload.inspection_id) ? payload.inspection_id : null,
    job_card_id: payload.job_card_id,
    raised_date: payload.raised_date,
    description: payload.description,
    disposition: payload.disposition,
    status: payload.status,
    closed_date: payload.status === 'closed' ? (payload.closed_date || new Date().toISOString().slice(0, 10)) : null,
    notes: payload.notes || null,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('wms_ncr').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_ncr').insert(row).select('*').single()
  if (error) throw error
  return data
}
