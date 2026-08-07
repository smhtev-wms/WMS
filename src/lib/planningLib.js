import { supabase } from './supabase'
import { isUuid } from './ordersLib'

export async function listRouteSheets() {
  const { data, error } = await supabase
    .from('wms_route_sheets')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  const sheets = data || []
  if (!sheets.length) return []

  const itemIds = [...new Set(sheets.map(s => s.item_id).filter(isUuid))]
  const { data: items, error: ie } = await supabase
    .from('wms_items')
    .select('id, item_code, description, drawing_number')
    .in('id', itemIds)
  if (ie) throw ie
  const itemsById = Object.fromEntries((items || []).map(i => [i.id, i]))

  const sheetIds = sheets.map(s => s.id)
  const { data: opCounts } = await supabase
    .from('wms_route_operations')
    .select('route_sheet_id')
    .in('route_sheet_id', sheetIds)

  const countBySheet = {}
  for (const row of opCounts || []) {
    countBySheet[row.route_sheet_id] = (countBySheet[row.route_sheet_id] || 0) + 1
  }

  return sheets.map(s => ({
    ...s,
    item: itemsById[s.item_id] || null,
    operation_count: countBySheet[s.id] || 0,
  }))
}

export async function getRouteSheet(id) {
  if (!isUuid(id)) throw new Error('Invalid route sheet id.')
  const { data: sheet, error } = await supabase.from('wms_route_sheets').select('*').eq('id', id).single()
  if (error) throw error

  const [{ data: item }, { data: ops, error: oe }] = await Promise.all([
    supabase.from('wms_items').select('id, item_code, description, drawing_number, revision').eq('id', sheet.item_id).maybeSingle(),
    supabase.from('wms_route_operations').select('*').eq('route_sheet_id', id).order('op_seq'),
  ])
  if (oe) throw oe
  return { ...sheet, item: item || null, operations: ops || [] }
}

export async function suggestRouteSheetCode(itemCode, revision = '0') {
  const base = `RS-${(itemCode || 'ITEM').replace(/\s+/g, '')}-${revision}`
  const { data } = await supabase.from('wms_route_sheets').select('sheet_code').ilike('sheet_code', `${base}%`)
  const existing = new Set((data || []).map(r => r.sheet_code))
  if (!existing.has(base)) return base
  let n = 2
  while (existing.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

export async function saveRouteSheet({ header, operations }, id) {
  const now = new Date().toISOString()
  const headerRow = {
    sheet_code: header.sheet_code,
    item_id: header.item_id,
    revision: header.revision || '0',
    status: header.status,
    notes: header.notes || null,
    updated_at: now,
  }

  let sheetId = id
  if (id) {
    const { error } = await supabase.from('wms_route_sheets').update(headerRow).eq('id', id)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('wms_route_sheets').insert(headerRow).select('id').single()
    if (error) throw error
    sheetId = data.id
  }

  await supabase.from('wms_route_operations').delete().eq('route_sheet_id', sheetId)

  const opRows = (operations || []).map((op, i) => ({
    route_sheet_id: sheetId,
    op_seq: op.op_seq ?? i + 1,
    operation_name: op.operation_name,
    machine_id: isUuid(op.machine_id) ? op.machine_id : null,
    subcontractor_id: isUuid(op.subcontractor_id) ? op.subcontractor_id : null,
    setup_minutes: Number(op.setup_minutes) || 0,
    cycle_minutes: Number(op.cycle_minutes) || 0,
    inspection_required: !!op.inspection_required,
    notes: op.notes || null,
    updated_at: now,
  }))

  if (opRows.length) {
    const { error } = await supabase.from('wms_route_operations').insert(opRows)
    if (error) throw error
  }

  return sheetId
}

export async function listPoLinesForPlanning() {
  const { data: pos, error: pe } = await supabase
    .from('wms_purchase_orders')
    .select('id, po_number, delivery_date, status')
    .order('po_number')
  if (pe) throw pe
  const openPos = (pos || []).filter(p => !['closed', 'cancelled'].includes(p.status))
  const poIds = openPos.map(p => p.id)
  if (!poIds.length) return []

  const { data: lines, error: le } = await supabase
    .from('wms_po_lines')
    .select('*')
    .in('po_id', poIds)
    .order('line_no')
  if (le) throw le

  const poById = Object.fromEntries(openPos.map(p => [p.id, p]))
  const itemIds = [...new Set((lines || []).map(l => l.item_id).filter(isUuid))]
  let itemsById = {}
  if (itemIds.length) {
    const { data: items } = await supabase.from('wms_items').select('id, item_code, description').in('id', itemIds)
    itemsById = Object.fromEntries((items || []).map(i => [i.id, i]))
  }

  return (lines || []).map(l => ({
    ...l,
    po: poById[l.po_id],
    item: l.item_id ? itemsById[l.item_id] : null,
    label: `${poById[l.po_id]?.po_number || 'PO'} / L${l.line_no} — ${l.description}`,
  }))
}

export async function listScheduleEntries({ machineId, from, to } = {}) {
  let q = supabase.from('wms_machine_schedule').select('*').order('planned_start')
  if (machineId) q = q.eq('machine_id', machineId)
  if (from) q = q.gte('planned_start', from)
  if (to) q = q.lte('planned_start', to)
  const { data, error } = await q
  if (error) throw error
  const rows = data || []
  if (!rows.length) return []

  const machineIds = [...new Set(rows.map(r => r.machine_id))]
  const lineIds = [...new Set(rows.map(r => r.po_line_id))]
  const opIds = [...new Set(rows.map(r => r.route_operation_id).filter(isUuid))]

  const [{ data: machines }, { data: lines }, { data: ops }] = await Promise.all([
    supabase.from('wms_machines').select('id, machine_code, name').in('id', machineIds),
    supabase.from('wms_po_lines').select('id, line_no, description, po_id, qty').in('id', lineIds),
    opIds.length
      ? supabase.from('wms_route_operations').select('id, op_seq, operation_name').in('id', opIds)
      : Promise.resolve({ data: [] }),
  ])

  const poIds = [...new Set((lines || []).map(l => l.po_id))]
  const { data: pos } = poIds.length
    ? await supabase.from('wms_purchase_orders').select('id, po_number').in('id', poIds)
    : { data: [] }

  const machineById = Object.fromEntries((machines || []).map(m => [m.id, m]))
  const lineById = Object.fromEntries((lines || []).map(l => [l.id, l]))
  const poById = Object.fromEntries((pos || []).map(p => [p.id, p]))
  const opById = Object.fromEntries((ops || []).map(o => [o.id, o]))

  return rows.map(r => {
    const line = lineById[r.po_line_id]
    return {
      ...r,
      machine: machineById[r.machine_id],
      po_line: line,
      po: line ? poById[line.po_id] : null,
      route_operation: r.route_operation_id ? opById[r.route_operation_id] : null,
    }
  })
}

export async function saveScheduleEntry(payload, id) {
  const row = {
    machine_id: payload.machine_id,
    po_line_id: payload.po_line_id,
    route_operation_id: isUuid(payload.route_operation_id) ? payload.route_operation_id : null,
    planned_start: payload.planned_start,
    planned_end: payload.planned_end,
    status: payload.status || 'planned',
    notes: payload.notes || null,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('wms_machine_schedule').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_machine_schedule').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function deleteScheduleEntry(id) {
  const { error } = await supabase.from('wms_machine_schedule').delete().eq('id', id)
  if (error) throw error
}

export async function listRouteOperationsForItem(itemId) {
  if (!isUuid(itemId)) return []
  const { data: sheets } = await supabase
    .from('wms_route_sheets')
    .select('id, sheet_code, revision, status')
    .eq('item_id', itemId)
    .eq('status', 'released')
    .order('revision', { ascending: false })
  if (!sheets?.length) return []
  const sheetIds = sheets.map(s => s.id)
  const { data: ops, error } = await supabase
    .from('wms_route_operations')
    .select('*')
    .in('route_sheet_id', sheetIds)
    .order('op_seq')
  if (error) throw error
  const sheetById = Object.fromEntries(sheets.map(s => [s.id, s]))
  return (ops || []).map(op => ({
    ...op,
    sheet: sheetById[op.route_sheet_id],
    label: `${sheetById[op.route_sheet_id]?.sheet_code} — Op ${op.op_seq}: ${op.operation_name}`,
  }))
}

export async function getProductionPlanRows() {
  const lines = await listPoLinesForPlanning()
  if (!lines.length) return []

  const lineIds = lines.map(l => l.id)
  const itemIds = [...new Set(lines.map(l => l.item_id).filter(isUuid))]

  const [{ data: schedules }, { data: sheets }] = await Promise.all([
    supabase.from('wms_machine_schedule').select('po_line_id, planned_end, status').in('po_line_id', lineIds).neq('status', 'cancelled'),
    itemIds.length
      ? supabase.from('wms_route_sheets').select('id, item_id, revision, status').in('item_id', itemIds)
      : Promise.resolve({ data: [] }),
  ])

  const latestEndByLine = {}
  for (const s of schedules || []) {
    const end = s.planned_end ? new Date(s.planned_end).getTime() : 0
    if (!latestEndByLine[s.po_line_id] || end > latestEndByLine[s.po_line_id]) {
      latestEndByLine[s.po_line_id] = end
    }
  }

  const releasedSheetByItem = {}
  for (const sh of sheets || []) {
    if (sh.status !== 'released') continue
    if (!releasedSheetByItem[sh.item_id]) releasedSheetByItem[sh.item_id] = sh
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return lines.map(line => {
    const delivery = line.po?.delivery_date || line.line_delivery
    const deliveryMs = delivery ? new Date(delivery + 'T00:00:00').getTime() : null
    const plannedEndMs = latestEndByLine[line.id] || null
    let daysToDelivery = null
    let planRisk = 'unknown'
    if (deliveryMs != null) {
      daysToDelivery = Math.ceil((deliveryMs - today.getTime()) / 86400000)
      if (plannedEndMs == null) planRisk = 'no_schedule'
      else {
        const plannedEndDate = new Date(plannedEndMs)
        plannedEndDate.setHours(0, 0, 0, 0)
        planRisk = plannedEndDate.getTime() > deliveryMs ? 'late' : daysToDelivery <= 7 ? 'tight' : 'ok'
      }
    }
    return {
      ...line,
      has_route: line.item_id ? !!releasedSheetByItem[line.item_id] : false,
      planned_end: plannedEndMs ? new Date(plannedEndMs).toISOString() : null,
      days_to_delivery: daysToDelivery,
      plan_risk: planRisk,
    }
  })
}
