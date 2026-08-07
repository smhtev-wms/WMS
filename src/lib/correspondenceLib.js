import { supabase } from './supabase'
import { isUuid } from './ordersLib'
import { nextDocNo } from './orderConstants'

export async function suggestCorrNo() {
  const { data } = await supabase.from('wms_correspondence').select('corr_no')
  return nextDocNo('COR', data || [])
}

export async function listCorrespondence() {
  const { data, error } = await supabase.from('wms_correspondence').select('*').order('corr_date', { ascending: false }).limit(200)
  if (error) throw error
  const rows = data || []
  const customerIds = [...new Set(rows.map(r => r.customer_id).filter(isUuid))]
  const poIds = [...new Set(rows.map(r => r.po_id).filter(isUuid))]
  let customerById = {}
  let poById = {}
  if (customerIds.length) {
    const { data: customers } = await supabase.from('wms_customers').select('id, customer_code, name').in('id', customerIds)
    customerById = Object.fromEntries((customers || []).map(c => [c.id, c]))
  }
  if (poIds.length) {
    const { data: pos } = await supabase.from('wms_purchase_orders').select('id, po_number').in('id', poIds)
    poById = Object.fromEntries((pos || []).map(p => [p.id, p]))
  }
  return rows.map(r => ({
    ...r,
    customer: customerById[r.customer_id],
    po: poById[r.po_id],
  }))
}

export async function listPoBriefForCorr() {
  const { data, error } = await supabase
    .from('wms_purchase_orders')
    .select('id, po_number, customer_id')
    .order('po_number', { ascending: false })
    .limit(150)
  if (error) throw error
  return data || []
}

export async function saveCorrespondence(payload, id) {
  const row = {
    corr_no: payload.corr_no,
    direction: payload.direction,
    customer_id: isUuid(payload.customer_id) ? payload.customer_id : null,
    po_id: isUuid(payload.po_id) ? payload.po_id : null,
    subject: payload.subject,
    corr_date: payload.corr_date,
    reference_no: payload.reference_no || null,
    channel: payload.channel,
    summary: payload.summary || null,
    follow_up_date: payload.follow_up_date || null,
    status: payload.status,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('wms_correspondence').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_correspondence').insert(row).select('*').single()
  if (error) throw error
  return data
}
