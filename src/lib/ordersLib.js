import { supabase } from './supabase'
import { nextDocNo } from './orderConstants'

const PO_BUCKET = 'wms-po-attachments'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

async function attachCustomers(rows, customerIdKey = 'customer_id') {
  if (!rows?.length) return []
  const customerIds = [...new Set(rows.map(r => r[customerIdKey]).filter(isUuid))]
  if (!customerIds.length) {
    return rows.map(row => ({ ...row, customer: null }))
  }
  const { data: customers, error } = await supabase
    .from('wms_customers')
    .select('id, customer_code, name')
    .in('id', customerIds)
  if (error) throw error
  const byId = Object.fromEntries((customers || []).map(c => [c.id, c]))
  return rows.map(row => ({
    ...row,
    customer: byId[row[customerIdKey]] || null,
  }))
}

export async function listEnquiries() {
  const { data, error } = await supabase
    .from('wms_enquiries')
    .select('*')
    .order('enquiry_date', { ascending: false })
  if (error) throw error
  return attachCustomers(data || [])
}

export async function saveEnquiry(payload, id) {
  const row = { ...payload, updated_at: new Date().toISOString() }
  delete row.customer
  delete row.wms_customers
  if (id) {
    const { data, error } = await supabase.from('wms_enquiries').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_enquiries').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function suggestEnquiryNo() {
  const { data } = await supabase.from('wms_enquiries').select('enquiry_no')
  return nextDocNo('ENQ', data || [])
}

export async function listPurchaseOrders() {
  const { data, error } = await supabase
    .from('wms_purchase_orders')
    .select('*')
    .order('po_date', { ascending: false })
  if (error) throw error
  return attachCustomers(data || [])
}

export async function getPurchaseOrder(id) {
  if (!isUuid(id)) {
    throw new Error('Invalid purchase order id.')
  }

  const { data: po, error } = await supabase
    .from('wms_purchase_orders')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error

  const [{ data: customer }, { data: lines, error: le }] = await Promise.all([
    supabase
      .from('wms_customers')
      .select('id, customer_code, name')
      .eq('id', po.customer_id)
      .maybeSingle(),
    supabase
      .from('wms_po_lines')
      .select('*')
      .eq('po_id', id)
      .order('line_no'),
  ])
  if (le) throw le

  const itemIds = [...new Set((lines || []).map(l => l.item_id).filter(isUuid))]
  let itemsById = {}
  if (itemIds.length) {
    const { data: items, error: ie } = await supabase
      .from('wms_items')
      .select('id, item_code, drawing_number')
      .in('id', itemIds)
    if (ie) throw ie
    itemsById = Object.fromEntries((items || []).map(it => [it.id, it]))
  }

  const { data: attachments } = await supabase
    .from('wms_po_attachments')
    .select('*')
    .eq('po_id', id)
    .order('created_at', { ascending: false })

  return {
    ...po,
    customer: customer || null,
    lines: (lines || []).map(l => ({
      ...l,
      item: l.item_id ? itemsById[l.item_id] || null : null,
    })),
    attachments: attachments || [],
  }
}

export async function suggestPoNumber() {
  const { data } = await supabase.from('wms_purchase_orders').select('po_number')
  return nextDocNo('PO', data || [])
}

function poSnapshot(po, lines) {
  const { wms_customers, customer, ...header } = po || {}
  return {
    header,
    lines: (lines || []).map(({ wms_items, item, ...l }) => l),
  }
}

export async function savePurchaseOrder({ header, lines }, { id, userId, amendmentReason } = {}) {
  const now = new Date().toISOString()
  let previous = null

  if (id) {
    previous = await getPurchaseOrder(id)
  }

  const headerRow = {
    po_number: header.po_number,
    customer_id: header.customer_id,
    enquiry_id: header.enquiry_id || null,
    customer_po_ref: header.customer_po_ref || null,
    po_date: header.po_date,
    delivery_date: header.delivery_date || null,
    status: header.status,
    currency: header.currency || 'INR',
    notes: header.notes || null,
    updated_at: now,
  }

  let poId = id
  if (id) {
    const { error } = await supabase.from('wms_purchase_orders').update(headerRow).eq('id', id)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from('wms_purchase_orders').insert(headerRow).select('id').single()
    if (error) throw error
    poId = data.id
  }

  const { error: delErr } = await supabase.from('wms_po_lines').delete().eq('po_id', poId)
  if (delErr) throw delErr

  const lineRows = (lines || []).map((l, i) => ({
    po_id: poId,
    line_no: l.line_no ?? i + 1,
    item_id: isUuid(l.item_id) ? l.item_id : null,
    description: l.description,
    drawing_number: l.drawing_number || null,
    revision: l.revision || null,
    qty: Number(l.qty) || 1,
    uom: l.uom || 'NOS',
    unit_rate: l.unit_rate != null && l.unit_rate !== '' ? Number(l.unit_rate) : null,
    line_delivery: l.line_delivery || null,
    notes: l.notes || null,
    updated_at: now,
  }))

  if (lineRows.length) {
    const { error: insErr } = await supabase.from('wms_po_lines').insert(lineRows)
    if (insErr) throw insErr
  }

  if (id && previous && amendmentReason?.trim()) {
    const after = await getPurchaseOrder(poId)
    const { count } = await supabase
      .from('wms_po_amendments')
      .select('*', { count: 'exact', head: true })
      .eq('po_id', poId)

    await supabase.from('wms_po_amendments').insert({
      po_id: poId,
      amendment_no: (count || 0) + 1,
      reason: amendmentReason.trim(),
      snapshot_before: poSnapshot(previous, previous.lines),
      snapshot_after: poSnapshot(after, after.lines),
      created_by: userId || null,
    })
  }

  return poId
}

export async function listPoAmendments(poId) {
  const { data, error } = await supabase
    .from('wms_po_amendments')
    .select('*')
    .eq('po_id', poId)
    .order('amendment_no', { ascending: false })
  if (error) throw error
  return data || []
}

export async function uploadPoAttachment(poId, file, userId) {
  const safeName = file.name.replace(/[^\w.\-() ]+/g, '_')
  const path = `${poId}/${Date.now()}_${safeName}`
  const { error: upErr } = await supabase.storage.from(PO_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (upErr) throw upErr

  const { data, error } = await supabase.from('wms_po_attachments').insert({
    po_id: poId,
    file_name: file.name,
    storage_path: path,
    mime_type: file.type || null,
    file_size: file.size,
    uploaded_by: userId || null,
  }).select('*').single()
  if (error) throw error
  return data
}

export async function deletePoAttachment(row) {
  await supabase.storage.from(PO_BUCKET).remove([row.storage_path])
  const { error } = await supabase.from('wms_po_attachments').delete().eq('id', row.id)
  if (error) throw error
}

export async function downloadPoAttachment(row) {
  const { data, error } = await supabase.storage.from(PO_BUCKET).createSignedUrl(row.storage_path, 120)
  if (error) throw error
  return data.signedUrl
}

export async function getOrderStatusSummary() {
  const { data, error } = await supabase
    .from('wms_purchase_orders')
    .select('id, status, delivery_date, po_number, customer_id')
  if (error) throw error
  const rows = await attachCustomers(data || [])
  const byStatus = {}
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const overdue = rows.filter(r => {
    if (!r.delivery_date) return false
    if (['closed', 'cancelled', 'dispatched'].includes(r.status)) return false
    return new Date(r.delivery_date + 'T00:00:00') < today
  })
  return { byStatus, total: rows.length, overdue, rows }
}

export async function listOpenEnquiries() {
  const { data, error } = await supabase
    .from('wms_enquiries')
    .select('id, enquiry_no, subject, status')
    .in('status', ['open', 'quoted', 'won'])
    .order('enquiry_no')
  if (error) throw error
  return data || []
}
