import { supabase } from './supabase'
import { isUuid } from './ordersLib'
import { nextDocNo } from './orderConstants'
import { addDays } from './phase3Constants'

export async function suggestTenderNo() {
  const { data } = await supabase.from('wms_tenders').select('tender_no')
  return nextDocNo('TND', data || [])
}

export async function listTenders() {
  const { data, error } = await supabase.from('wms_tenders').select('*').order('submission_due', { ascending: true })
  if (error) throw error
  const rows = data || []
  const customerIds = [...new Set(rows.map(r => r.customer_id).filter(isUuid))]
  let customerById = {}
  if (customerIds.length) {
    const { data: customers } = await supabase.from('wms_customers').select('id, customer_code, name').in('id', customerIds)
    customerById = Object.fromEntries((customers || []).map(c => [c.id, c]))
  }
  return rows.map(r => ({ ...r, customer: customerById[r.customer_id] }))
}

export async function saveTender(payload, id) {
  const row = {
    tender_no: payload.tender_no,
    title: payload.title,
    customer_id: isUuid(payload.customer_id) ? payload.customer_id : null,
    portal_ref: payload.portal_ref || null,
    published_date: payload.published_date || null,
    submission_due: payload.submission_due,
    status: payload.status,
    estimated_value: payload.estimated_value === '' || payload.estimated_value == null ? null : Number(payload.estimated_value),
    notes: payload.notes || null,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('wms_tenders').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_tenders').insert(row).select('*').single()
  if (error) throw error
  return data
}
