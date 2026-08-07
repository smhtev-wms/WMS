export const ENQUIRY_STATUSES = [
  { value: 'open', label: 'Open', color: '#2563eb', bg: '#dbeafe' },
  { value: 'quoted', label: 'Quoted', color: '#7c3aed', bg: '#ede9fe' },
  { value: 'won', label: 'Won', color: '#16a34a', bg: '#dcfce7' },
  { value: 'lost', label: 'Lost', color: '#64748b', bg: '#f1f5f9' },
  { value: 'cancelled', label: 'Cancelled', color: '#dc2626', bg: '#fee2e2' },
]

export const PO_STATUSES = [
  { value: 'draft', label: 'Draft', color: '#64748b', bg: '#f1f5f9' },
  { value: 'released', label: 'Released', color: '#2563eb', bg: '#dbeafe' },
  { value: 'in_production', label: 'In production', color: '#d97706', bg: '#ffedd5' },
  { value: 'inspection', label: 'Inspection', color: '#7c3aed', bg: '#ede9fe' },
  { value: 'ready_dispatch', label: 'Ready to dispatch', color: '#0891b2', bg: '#cffafe' },
  { value: 'dispatched', label: 'Dispatched', color: '#16a34a', bg: '#dcfce7' },
  { value: 'closed', label: 'Closed', color: '#374151', bg: '#e5e7eb' },
  { value: 'cancelled', label: 'Cancelled', color: '#dc2626', bg: '#fee2e2' },
]

export function statusMeta(list, value) {
  return list.find(s => s.value === value) || { label: value, color: '#64748b', bg: '#f1f5f9' }
}

export function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = String(d).split('-')
  return `${day}/${m}/${y}`
}

export function fmtAmt(n) {
  if (n == null || n === '') return '—'
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function nextDocNo(prefix, existing = []) {
  const year = new Date().getFullYear()
  const pat = new RegExp(`^${prefix}-${year}-(\\d+)$`)
  let max = 0
  for (const row of existing) {
    const no = row.enquiry_no || row.po_number || row.job_number || row.sheet_code || row.inward_no || row.issue_no
    const m = String(no || '').match(pat)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `${prefix}-${year}-${String(max + 1).padStart(4, '0')}`
}
