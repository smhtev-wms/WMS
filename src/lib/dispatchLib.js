import { supabase } from './supabase'
import { isUuid } from './ordersLib'
import { nextDocNo } from './orderConstants'

export async function suggestDispatchNo() {
  const { data } = await supabase.from('wms_dispatches').select('dispatch_no')
  return nextDocNo('DC', data || [])
}

export async function getDispatchedQtyByPoLine(poLineIds) {
  if (!poLineIds?.length) return {}
  const { data: lines, error } = await supabase
    .from('wms_dispatch_lines')
    .select('po_line_id, qty_dispatched, dispatch_id')
    .in('po_line_id', poLineIds)
  if (error) throw error
  const dispatchIds = [...new Set((lines || []).map(l => l.dispatch_id))]
  let statusById = {}
  if (dispatchIds.length) {
    const { data: dispatches } = await supabase.from('wms_dispatches').select('id, status').in('id', dispatchIds)
    statusById = Object.fromEntries((dispatches || []).map(d => [d.id, d.status]))
  }
  const totals = {}
  for (const row of lines || []) {
    if (statusById[row.dispatch_id] === 'cancelled') continue
    totals[row.po_line_id] = (totals[row.po_line_id] || 0) + Number(row.qty_dispatched)
  }
  return totals
}

export async function listDispatches() {
  const { data, error } = await supabase.from('wms_dispatches').select('*').order('dispatch_date', { ascending: false })
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []

  const customerIds = [...new Set(rows.map(r => r.customer_id))]
  const poIds = [...new Set(rows.map(r => r.po_id))]
  const [{ data: customers }, { data: pos }] = await Promise.all([
    supabase.from('wms_customers').select('id, name, customer_code').in('id', customerIds),
    supabase.from('wms_purchase_orders').select('id, po_number').in('id', poIds),
  ])
  const custById = Object.fromEntries((customers || []).map(c => [c.id, c]))
  const poById = Object.fromEntries((pos || []).map(p => [p.id, p]))
  return rows.map(r => ({ ...r, customer: custById[r.customer_id], po: poById[r.po_id] }))
}

export async function getDispatch(id) {
  if (!isUuid(id)) throw new Error('Invalid dispatch id.')
  const { data: header, error } = await supabase.from('wms_dispatches').select('*').eq('id', id).single()
  if (error) throw error

  const { data: lines, error: le } = await supabase.from('wms_dispatch_lines').select('*').eq('dispatch_id', id)
  if (le) throw le

  const { data: po } = await supabase.from('wms_purchase_orders').select('*').eq('id', header.po_id).single()
  const { data: poLines } = await supabase.from('wms_po_lines').select('*').eq('po_id', header.po_id).order('line_no')
  const lineIds = (poLines || []).map(l => l.id)
  const dispatched = await getDispatchedQtyByPoLine(lineIds)
  for (const l of lines || []) {
    dispatched[l.po_line_id] = Math.max(0, (dispatched[l.po_line_id] || 0) - Number(l.qty_dispatched))
  }

  const { data: customer } = await supabase.from('wms_customers').select('id, name, customer_code').eq('id', header.customer_id).maybeSingle()

  return {
    ...header,
    customer,
    po,
    po_lines: (poLines || []).map(l => ({
      ...l,
      qty_already_dispatched: dispatched[l.id] || 0,
      qty_remaining: Number(l.qty) - (dispatched[l.id] || 0),
    })),
    lines: lines || [],
  }
}

export async function getPoOptionsForDispatch() {
  const { data: pos, error } = await supabase
    .from('wms_purchase_orders')
    .select('id, po_number, customer_id, status')
    .order('po_number')
  if (error) throw error
  return (pos || []).filter(p => !['closed', 'cancelled'].includes(p.status))
}

export async function loadPoLinesForDispatch(poId) {
  if (!isUuid(poId)) return { po: null, lines: [] }
  const { data: po, error } = await supabase.from('wms_purchase_orders').select('*').eq('id', poId).single()
  if (error) throw error
  const { data: poLines } = await supabase.from('wms_po_lines').select('*').eq('po_id', poId).order('line_no')
  const lineIds = (poLines || []).map(l => l.id)
  const dispatched = await getDispatchedQtyByPoLine(lineIds)
  const lines = (poLines || []).map(l => ({
    ...l,
    qty_already_dispatched: dispatched[l.id] || 0,
    qty_remaining: Math.max(0, Number(l.qty) - (dispatched[l.id] || 0)),
  }))
  return { po, lines }
}

export async function saveDispatch({ header, lineQtys }, id) {
  const now = new Date().toISOString()
  const headerRow = {
    dispatch_no: header.dispatch_no,
    po_id: header.po_id,
    customer_id: header.customer_id,
    dispatch_date: header.dispatch_date,
    vehicle_no: header.vehicle_no || null,
    lr_number: header.lr_number || null,
    transporter: header.transporter || null,
    destination: header.destination || null,
    status: header.status || 'draft',
    notes: header.notes || null,
    updated_at: now,
  }

  let dispatchId = id
  if (id) {
    const { error } = await supabase.from('wms_dispatches').update(headerRow).eq('id', id)
    if (error) throw error
    await supabase.from('wms_dispatch_lines').delete().eq('dispatch_id', id)
  } else {
    const { data, error } = await supabase.from('wms_dispatches').insert(headerRow).select('id').single()
    if (error) throw error
    dispatchId = data.id
  }

  const lineRows = Object.entries(lineQtys || {})
    .filter(([, qty]) => Number(qty) > 0)
    .map(([po_line_id, qty]) => ({
      dispatch_id: dispatchId,
      po_line_id,
      qty_dispatched: Number(qty),
    }))

  if (lineRows.length) {
    const { error } = await supabase.from('wms_dispatch_lines').insert(lineRows)
    if (error) throw error
  }

  if (headerRow.status === 'dispatched') {
    await maybeUpdatePoDispatchStatus(header.po_id)
  }

  return dispatchId
}

async function maybeUpdatePoDispatchStatus(poId) {
  const { data: poLines } = await supabase.from('wms_po_lines').select('id, qty').eq('po_id', poId)
  const lineIds = (poLines || []).map(l => l.id)
  const dispatched = await getDispatchedQtyByPoLine(lineIds)
  const allShipped = (poLines || []).every(l => (dispatched[l.id] || 0) >= Number(l.qty))
  if (allShipped) {
    await supabase.from('wms_purchase_orders').update({
      status: 'dispatched',
      updated_at: new Date().toISOString(),
    }).eq('id', poId)
  }
}
