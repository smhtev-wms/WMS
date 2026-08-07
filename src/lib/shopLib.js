import { supabase } from './supabase'
import { isUuid } from './ordersLib'
import { nextDocNo } from './orderConstants'
import { listPoLinesForPlanning } from './planningLib'

export { listPoLinesForPlanning }

export async function suggestJobNumber() {
  const { data } = await supabase.from('wms_job_cards').select('job_number')
  return nextDocNo('JC', data || [])
}

async function routeOpsForItem(itemId) {
  if (!isUuid(itemId)) return []
  const { data: sheets } = await supabase
    .from('wms_route_sheets')
    .select('id')
    .eq('item_id', itemId)
    .eq('status', 'released')
    .order('revision', { ascending: false })
    .limit(1)
  if (!sheets?.length) return []
  const { data: ops, error } = await supabase
    .from('wms_route_operations')
    .select('*')
    .eq('route_sheet_id', sheets[0].id)
    .order('op_seq')
  if (error) throw error
  return ops || []
}

export async function listJobCards() {
  const { data, error } = await supabase
    .from('wms_job_cards')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  const cards = data || []
  if (!cards.length) return []

  const lineIds = [...new Set(cards.map(c => c.po_line_id))]
  const { data: lines } = await supabase.from('wms_po_lines').select('id, line_no, description, po_id, qty').in('id', lineIds)
  const poIds = [...new Set((lines || []).map(l => l.po_id))]
  const { data: pos } = poIds.length
    ? await supabase.from('wms_purchase_orders').select('id, po_number').in('id', poIds)
    : { data: [] }
  const lineById = Object.fromEntries((lines || []).map(l => [l.id, l]))
  const poById = Object.fromEntries((pos || []).map(p => [p.id, p]))

  return cards.map(c => {
    const line = lineById[c.po_line_id]
    return {
      ...c,
      po_line: line,
      po: line ? poById[line.po_id] : null,
    }
  })
}

export async function getJobCard(id) {
  if (!isUuid(id)) throw new Error('Invalid job card id.')
  const { data: card, error } = await supabase.from('wms_job_cards').select('*').eq('id', id).single()
  if (error) throw error

  const [{ data: ops }, { data: line }] = await Promise.all([
    supabase.from('wms_job_operations').select('*').eq('job_card_id', id).order('op_seq'),
    supabase.from('wms_po_lines').select('*').eq('id', card.po_line_id).maybeSingle(),
  ])

  let po = null
  let item = null
  if (line?.po_id) {
    const { data: p } = await supabase.from('wms_purchase_orders').select('id, po_number, delivery_date, status').eq('id', line.po_id).maybeSingle()
    po = p
  }
  if (card.item_id) {
    const { data: it } = await supabase.from('wms_items').select('id, item_code, description').eq('id', card.item_id).maybeSingle()
    item = it
  }

  return { ...card, operations: ops || [], po_line: line, po, item }
}

export async function createJobCard({ po_line_id, job_number, priority, notes }) {
  const lines = await listPoLinesForPlanning()
  const line = lines.find(l => l.id === po_line_id)
  if (!line) throw new Error('PO line not found or PO is closed.')

  const qty = Number(line.qty) || 1
  const due = line.po?.delivery_date || line.line_delivery || null
  const now = new Date().toISOString()

  const { data: card, error } = await supabase.from('wms_job_cards').insert({
    job_number,
    po_line_id,
    item_id: line.item_id || null,
    qty_ordered: qty,
    qty_completed: 0,
    status: 'open',
    priority: priority || 'normal',
    due_date: due,
    notes: notes || null,
    updated_at: now,
  }).select('id').single()
  if (error) throw error

  const routeOps = await routeOpsForItem(line.item_id)
  if (routeOps.length) {
    const rows = routeOps.map(op => ({
      job_card_id: card.id,
      route_operation_id: op.id,
      op_seq: op.op_seq,
      operation_name: op.operation_name,
      machine_id: op.machine_id,
      status: 'pending',
      qty_done: 0,
      updated_at: now,
    }))
    await supabase.from('wms_job_operations').insert(rows)
  } else {
    await supabase.from('wms_job_operations').insert({
      job_card_id: card.id,
      op_seq: 1,
      operation_name: 'Production',
      status: 'pending',
      qty_done: 0,
      updated_at: now,
    })
  }

  return card.id
}

export async function updateJobCard(id, patch) {
  const row = { ...patch, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('wms_job_cards').update(row).eq('id', id)
  if (error) throw error
}

export async function updateJobOperation(opId, patch) {
  const row = { ...patch, updated_at: new Date().toISOString() }
  if (patch.status === 'in_progress' && !patch.started_at) row.started_at = new Date().toISOString()
  if (patch.status === 'done' && !patch.completed_at) row.completed_at = new Date().toISOString()
  const { error } = await supabase.from('wms_job_operations').update(row).eq('id', opId)
  if (error) throw error

  const { data: op } = await supabase.from('wms_job_operations').select('job_card_id, status').eq('id', opId).single()
  if (op) await recomputeJobCardStatus(op.job_card_id)
}

async function recomputeJobCardStatus(jobCardId) {
  const { data: ops } = await supabase.from('wms_job_operations').select('status').eq('job_card_id', jobCardId)
  const list = ops || []
  if (!list.length) return
  const allDone = list.every(o => o.status === 'done' || o.status === 'skipped')
  const anyProgress = list.some(o => o.status === 'in_progress' || o.status === 'done')
  let status = 'open'
  if (allDone) status = 'complete'
  else if (anyProgress) status = 'in_progress'
  await updateJobCard(jobCardId, { status })
}

export async function listDprEntries({ from, to } = {}) {
  let q = supabase.from('wms_dpr_entries').select('*').order('report_date', { ascending: false })
  if (from) q = q.gte('report_date', from)
  if (to) q = q.lte('report_date', to)
  const { data, error } = await q.limit(200)
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []

  const jobIds = [...new Set(rows.map(r => r.job_card_id))]
  const { data: jobs } = await supabase.from('wms_job_cards').select('id, job_number').in('id', jobIds)
  const jobById = Object.fromEntries((jobs || []).map(j => [j.id, j]))

  const opIds = [...new Set(rows.map(r => r.job_operation_id).filter(isUuid))]
  const { data: ops } = opIds.length
    ? await supabase.from('wms_job_operations').select('id, op_seq, operation_name').in('id', opIds)
    : { data: [] }
  const opById = Object.fromEntries((ops || []).map(o => [o.id, o]))

  const operatorIds = [...new Set(rows.map(r => r.operator_id).filter(isUuid))]
  const { data: operators } = operatorIds.length
    ? await supabase.from('wms_operators').select('id, full_name, employee_code').in('id', operatorIds)
    : { data: [] }
  const optrById = Object.fromEntries((operators || []).map(o => [o.id, o]))

  const machineIds = [...new Set(rows.map(r => r.machine_id).filter(isUuid))]
  const { data: machines } = machineIds.length
    ? await supabase.from('wms_machines').select('id, machine_code').in('id', machineIds)
    : { data: [] }
  const machById = Object.fromEntries((machines || []).map(m => [m.id, m]))

  return rows.map(r => ({
    ...r,
    job: jobById[r.job_card_id],
    job_operation: r.job_operation_id ? opById[r.job_operation_id] : null,
    operator: r.operator_id ? optrById[r.operator_id] : null,
    machine: r.machine_id ? machById[r.machine_id] : null,
  }))
}

export async function saveDprEntry(payload, id) {
  const row = {
    report_date: payload.report_date,
    job_card_id: payload.job_card_id,
    job_operation_id: isUuid(payload.job_operation_id) ? payload.job_operation_id : null,
    operator_id: isUuid(payload.operator_id) ? payload.operator_id : null,
    machine_id: isUuid(payload.machine_id) ? payload.machine_id : null,
    qty_produced: Number(payload.qty_produced) || 0,
    qty_rejected: Number(payload.qty_rejected) || 0,
    hours_spent: Number(payload.hours_spent) || 0,
    shift: payload.shift || null,
    notes: payload.notes || null,
  }
  if (id) {
    const { data, error } = await supabase.from('wms_dpr_entries').update(row).eq('id', id).select('*').single()
    if (error) throw error
    await syncJobQtyFromDpr(row.job_card_id)
    return data
  }
  const { data, error } = await supabase.from('wms_dpr_entries').insert(row).select('*').single()
  if (error) throw error
  await syncJobQtyFromDpr(row.job_card_id)
  return data
}

async function syncJobQtyFromDpr(jobCardId) {
  const { data } = await supabase.from('wms_dpr_entries').select('qty_produced').eq('job_card_id', jobCardId)
  const total = (data || []).reduce((s, r) => s + Number(r.qty_produced || 0), 0)
  await updateJobCard(jobCardId, { qty_completed: total })
}

export async function listDowntimeLogs({ machineId, openOnly } = {}) {
  let q = supabase.from('wms_downtime_logs').select('*').order('started_at', { ascending: false })
  if (machineId) q = q.eq('machine_id', machineId)
  if (openOnly) q = q.is('ended_at', null)
  const { data, error } = await q.limit(100)
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []

  const machineIds = [...new Set(rows.map(r => r.machine_id))]
  const { data: machines } = await supabase.from('wms_machines').select('id, machine_code, name').in('id', machineIds)
  const machById = Object.fromEntries((machines || []).map(m => [m.id, m]))
  return rows.map(r => ({ ...r, machine: machById[r.machine_id] }))
}

export async function saveDowntimeLog(payload, id) {
  const row = {
    machine_id: payload.machine_id,
    started_at: payload.started_at,
    ended_at: payload.ended_at || null,
    category: payload.category || 'other',
    reason: payload.reason,
    notes: payload.notes || null,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('wms_downtime_logs').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_downtime_logs').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function listJobCardsBrief() {
  const { data, error } = await supabase
    .from('wms_job_cards')
    .select('id, job_number, status')
    .order('job_number')
  if (error) throw error
  return (data || []).filter(j => !['closed', 'cancelled'].includes(j.status))
}

export async function listJobOperationsForCard(jobCardId) {
  if (!isUuid(jobCardId)) return []
  const { data, error } = await supabase
    .from('wms_job_operations')
    .select('id, op_seq, operation_name, status')
    .eq('job_card_id', jobCardId)
    .order('op_seq')
  if (error) throw error
  return data || []
}
