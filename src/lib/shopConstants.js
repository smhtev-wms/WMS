export const JOB_STATUSES = [
  { value: 'open', label: 'Open', color: '#2563eb', bg: '#dbeafe' },
  { value: 'in_progress', label: 'In progress', color: '#d97706', bg: '#ffedd5' },
  { value: 'inspection', label: 'Inspection', color: '#7c3aed', bg: '#ede9fe' },
  { value: 'complete', label: 'Complete', color: '#16a34a', bg: '#dcfce7' },
  { value: 'closed', label: 'Closed', color: '#374151', bg: '#e5e7eb' },
  { value: 'cancelled', label: 'Cancelled', color: '#dc2626', bg: '#fee2e2' },
]

export const OP_STATUSES = [
  { value: 'pending', label: 'Pending', color: '#64748b', bg: '#f1f5f9' },
  { value: 'in_progress', label: 'In progress', color: '#d97706', bg: '#ffedd5' },
  { value: 'done', label: 'Done', color: '#16a34a', bg: '#dcfce7' },
  { value: 'skipped', label: 'Skipped', color: '#94a3b8', bg: '#f8fafc' },
]

export const DOWNTIME_CATEGORIES = [
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'setup', label: 'Setup / changeover' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'power', label: 'Power / utility' },
  { value: 'material', label: 'Material wait' },
  { value: 'other', label: 'Other' },
]

export function statusMeta(list, value) {
  return list.find(s => s.value === value) || { label: value, color: '#64748b', bg: '#f1f5f9' }
}

export function fmtDate(d) {
  if (!d) return '—'
  const [y, m, day] = String(d).split('-')
  return `${day}/${m}/${y}`
}
