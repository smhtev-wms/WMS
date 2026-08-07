export const ROUTE_SHEET_STATUSES = [
  { value: 'draft', label: 'Draft', color: '#64748b', bg: '#f1f5f9' },
  { value: 'released', label: 'Released', color: '#16a34a', bg: '#dcfce7' },
  { value: 'obsolete', label: 'Obsolete', color: '#dc2626', bg: '#fee2e2' },
]

export const SCHEDULE_STATUSES = [
  { value: 'planned', label: 'Planned', color: '#2563eb', bg: '#dbeafe' },
  { value: 'in_progress', label: 'In progress', color: '#d97706', bg: '#ffedd5' },
  { value: 'done', label: 'Done', color: '#16a34a', bg: '#dcfce7' },
  { value: 'cancelled', label: 'Cancelled', color: '#64748b', bg: '#f1f5f9' },
]

export function statusMeta(list, value) {
  return list.find(s => s.value === value) || { label: value, color: '#64748b', bg: '#f1f5f9' }
}

export function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = String(d).split('-')
  return `${day}/${m}/${y}`
}

export function fmtDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function toLocalInputValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInputValue(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
