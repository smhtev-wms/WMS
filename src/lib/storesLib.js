import { supabase } from './supabase'
import { isUuid } from './ordersLib'
import { nextDocNo } from './orderConstants'

export async function suggestInwardNo() {
  const { data } = await supabase.from('wms_rm_inward').select('inward_no')
  return nextDocNo('RM', data || [])
}

export async function suggestIssueNo() {
  const { data } = await supabase.from('wms_material_issues').select('issue_no')
  return nextDocNo('MI', data || [])
}

async function attachMaterials(rows, materialIdKey = 'material_id') {
  if (!rows?.length) return []
  const ids = [...new Set(rows.map(r => r[materialIdKey]).filter(isUuid))]
  if (!ids.length) return rows.map(r => ({ ...r, material: null }))
  const { data: materials, error } = await supabase
    .from('wms_materials')
    .select('id, material_code, name, grade, uom')
    .in('id', ids)
  if (error) throw error
  const byId = Object.fromEntries((materials || []).map(m => [m.id, m]))
  return rows.map(r => ({ ...r, material: byId[r[materialIdKey]] || null }))
}

export async function listRmInward() {
  const { data, error } = await supabase
    .from('wms_rm_inward')
    .select('*')
    .order('received_date', { ascending: false })
  if (error) throw error
  return attachMaterials(data || [])
}

export async function saveRmInward(payload, id) {
  const now = new Date().toISOString()
  const qty = Number(payload.qty_received)
  if (!qty || qty <= 0) throw new Error('Quantity must be greater than zero.')

  if (id) {
    const { data: existing, error: fe } = await supabase.from('wms_rm_inward').select('qty_received, qty_balance').eq('id', id).single()
    if (fe) throw fe
    const issued = Number(existing.qty_received) - Number(existing.qty_balance)
    const newBalance = qty - issued
    if (newBalance < 0) throw new Error(`Cannot reduce below issued quantity (${issued}).`)

    const row = {
      inward_no: payload.inward_no,
      material_id: payload.material_id,
      heat_number: payload.heat_number || null,
      batch_number: payload.batch_number || null,
      supplier_name: payload.supplier_name || null,
      invoice_ref: payload.invoice_ref || null,
      qty_received: qty,
      qty_balance: newBalance,
      uom: payload.uom || 'KG',
      received_date: payload.received_date,
      storage_location: payload.storage_location || null,
      notes: payload.notes || null,
      updated_at: now,
    }
    const { data, error } = await supabase.from('wms_rm_inward').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }

  const row = {
    inward_no: payload.inward_no,
    material_id: payload.material_id,
    heat_number: payload.heat_number || null,
    batch_number: payload.batch_number || null,
    supplier_name: payload.supplier_name || null,
    invoice_ref: payload.invoice_ref || null,
    qty_received: qty,
    qty_balance: qty,
    uom: payload.uom || 'KG',
    received_date: payload.received_date,
    storage_location: payload.storage_location || null,
    notes: payload.notes || null,
    updated_at: now,
  }
  const { data, error } = await supabase.from('wms_rm_inward').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function listInwardLotsWithBalance() {
  const { data, error } = await supabase
    .from('wms_rm_inward')
    .select('*')
    .gt('qty_balance', 0)
    .order('received_date')
  if (error) throw error
  const rows = await attachMaterials(data || [])
  return rows.map(r => ({
    ...r,
    label: `${r.inward_no} — ${r.material?.material_code || 'MAT'} | Heat ${r.heat_number || '—'} | Bal ${r.qty_balance} ${r.uom}`,
  }))
}

export async function listMaterialIssues() {
  const { data, error } = await supabase
    .from('wms_material_issues')
    .select('*')
    .order('issued_date', { ascending: false })
    .limit(200)
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []

  const withMat = await attachMaterials(rows)
  const inwardIds = [...new Set(rows.map(r => r.inward_id))]
  const jobIds = [...new Set(rows.map(r => r.job_card_id).filter(isUuid))]
  const lineIds = [...new Set(rows.map(r => r.po_line_id).filter(isUuid))]

  const [{ data: inwards }, { data: jobs }, { data: lines }] = await Promise.all([
    supabase.from('wms_rm_inward').select('id, inward_no, heat_number').in('id', inwardIds),
    jobIds.length ? supabase.from('wms_job_cards').select('id, job_number').in('id', jobIds) : Promise.resolve({ data: [] }),
    lineIds.length ? supabase.from('wms_po_lines').select('id, line_no, description').in('id', lineIds) : Promise.resolve({ data: [] }),
  ])

  const inwardById = Object.fromEntries((inwards || []).map(i => [i.id, i]))
  const jobById = Object.fromEntries((jobs || []).map(j => [j.id, j]))
  const lineById = Object.fromEntries((lines || []).map(l => [l.id, l]))

  return withMat.map(r => ({
    ...r,
    inward: inwardById[r.inward_id],
    job: r.job_card_id ? jobById[r.job_card_id] : null,
    po_line: r.po_line_id ? lineById[r.po_line_id] : null,
  }))
}

export async function createMaterialIssue(payload) {
  const qty = Number(payload.qty_issued)
  if (!qty || qty <= 0) throw new Error('Issue quantity must be greater than zero.')
  if (!isUuid(payload.inward_id)) throw new Error('Select an inward lot.')

  const { data: inward, error: ie } = await supabase
    .from('wms_rm_inward')
    .select('id, material_id, qty_balance, uom')
    .eq('id', payload.inward_id)
    .single()
  if (ie) throw ie
  if (Number(inward.qty_balance) < qty) {
    throw new Error(`Insufficient balance. Available: ${inward.qty_balance} ${inward.uom}`)
  }

  const row = {
    issue_no: payload.issue_no,
    inward_id: payload.inward_id,
    material_id: inward.material_id,
    job_card_id: isUuid(payload.job_card_id) ? payload.job_card_id : null,
    po_line_id: isUuid(payload.po_line_id) ? payload.po_line_id : null,
    qty_issued: qty,
    uom: payload.uom || inward.uom || 'KG',
    issued_date: payload.issued_date,
    issued_to: payload.issued_to || null,
    notes: payload.notes || null,
  }

  const { error: insErr } = await supabase.from('wms_material_issues').insert(row)
  if (insErr) throw insErr

  const newBalance = Number(inward.qty_balance) - qty
  const { error: upErr } = await supabase
    .from('wms_rm_inward')
    .update({ qty_balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', inward.id)
  if (upErr) throw upErr
}
