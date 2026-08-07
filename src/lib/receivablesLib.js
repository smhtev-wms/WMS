import { supabase } from './supabase'
import { isUuid } from './ordersLib'
import { nextDocNo } from './orderConstants'
import { daysUntil } from './phase3Constants'

export const RECEIVABLE_STATUSES = [
  { value: 'open', label: 'Open', color: '#2563eb', bg: '#dbeafe' },
  { value: 'partial', label: 'Partial', color: '#d97706', bg: '#ffedd5' },
  { value: 'paid', label: 'Paid', color: '#16a34a', bg: '#dcfce7' },
  { value: 'written_off', label: 'Written off', color: '#64748b', bg: '#f1f5f9' },
]

export function ageingBucket(dueDate, status) {
  if (status === 'paid' || status === 'written_off') return 'closed'
  const d = daysUntil(dueDate)
  if (d == null) return 'unknown'
  if (d < 0) return 'overdue'
  if (d <= 30) return 'current'
  return 'not_due'
}

export async function suggestInvoiceNo() {
  const { data } = await supabase.from('wms_customer_receivables').select('invoice_no')
  return nextDocNo('INV', data || [])
}

export async function listReceivables() {
  const { data, error } = await supabase
    .from('wms_customer_receivables')
    .select('*')
    .order('due_date', { ascending: true })
  if (error) throw error
  const rows = data || []
  const customerIds = [...new Set(rows.map(r => r.customer_id))]
  const { data: customers } = await supabase.from('wms_customers').select('id, customer_code, name').in('id', customerIds)
  const customerById = Object.fromEntries((customers || []).map(c => [c.id, c]))
  const poIds = [...new Set(rows.map(r => r.po_id).filter(isUuid))]
  let poById = {}
  if (poIds.length) {
    const { data: pos } = await supabase.from('wms_purchase_orders').select('id, po_number').in('id', poIds)
    poById = Object.fromEntries((pos || []).map(p => [p.id, p]))
  }
  return rows.map(r => {
    const outstanding = Number(r.gross_amount) - Number(r.amount_received)
    return {
      ...r,
      customer: customerById[r.customer_id],
      po: poById[r.po_id],
      outstanding,
      bucket: ageingBucket(r.due_date, r.status),
    }
  })
}

export function receivablesAgeingSummary(rows) {
  const summary = { overdue: 0, current: 0, not_due: 0, total_outstanding: 0 }
  for (const r of rows) {
    if (r.status === 'paid' || r.status === 'written_off') continue
    const o = r.outstanding ?? 0
    summary.total_outstanding += o
    if (r.bucket === 'overdue') summary.overdue += o
    else if (r.bucket === 'current') summary.current += o
    else if (r.bucket === 'not_due') summary.not_due += o
  }
  return summary
}

export async function saveReceivable(payload, id) {
  const gross = Number(payload.gross_amount)
  const received = Number(payload.amount_received) || 0
  let status = payload.status
  if (!status) {
    if (received <= 0) status = 'open'
    else if (received >= gross) status = 'paid'
    else status = 'partial'
  }
  const row = {
    invoice_no: payload.invoice_no,
    customer_id: payload.customer_id,
    po_id: isUuid(payload.po_id) ? payload.po_id : null,
    dispatch_id: isUuid(payload.dispatch_id) ? payload.dispatch_id : null,
    invoice_date: payload.invoice_date,
    due_date: payload.due_date,
    gross_amount: gross,
    amount_received: received,
    status,
    notes: payload.notes || null,
    updated_at: new Date().toISOString(),
  }
  if (id) {
    const { data, error } = await supabase.from('wms_customer_receivables').update(row).eq('id', id).select('*').single()
    if (error) throw error
    return data
  }
  const { data, error } = await supabase.from('wms_customer_receivables').insert(row).select('*').single()
  if (error) throw error
  return data
}
