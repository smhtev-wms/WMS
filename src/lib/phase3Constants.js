import { fmtDate, statusMeta } from './orderConstants'

export { statusMeta }

export const TOOL_TYPES = [
  { value: 'tool', label: 'Cutting tool' },
  { value: 'gauge', label: 'Gauge / instrument' },
  { value: 'fixture', label: 'Fixture' },
  { value: 'other', label: 'Other' },
]

export const TENDER_STATUSES = [
  { value: 'open', label: 'Open', color: '#2563eb', bg: '#dbeafe' },
  { value: 'submitted', label: 'Submitted', color: '#7c3aed', bg: '#ede9fe' },
  { value: 'won', label: 'Won', color: '#16a34a', bg: '#dcfce7' },
  { value: 'lost', label: 'Lost', color: '#64748b', bg: '#f1f5f9' },
  { value: 'cancelled', label: 'Cancelled', color: '#dc2626', bg: '#fee2e2' },
]

export const CORR_DIRECTIONS = [
  { value: 'inbound', label: 'Inbound' },
  { value: 'outbound', label: 'Outbound' },
]

export const CORR_CHANNELS = [
  { value: 'letter', label: 'Letter' },
  { value: 'email', label: 'Email' },
  { value: 'portal', label: 'Portal / GEM' },
  { value: 'phone', label: 'Phone' },
  { value: 'other', label: 'Other' },
]

export const CORR_STATUSES = [
  { value: 'open', label: 'Open', color: '#d97706', bg: '#ffedd5' },
  { value: 'closed', label: 'Closed', color: '#16a34a', bg: '#dcfce7' },
]

export function addDays(isoDate, days) {
  if (!isoDate || !days) return null
  const d = new Date(isoDate + 'T12:00:00')
  d.setDate(d.getDate() + Number(days))
  return d.toISOString().slice(0, 10)
}

export function daysUntil(isoDate) {
  if (!isoDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(isoDate + 'T12:00:00')
  return Math.ceil((target - today) / (24 * 60 * 60 * 1000))
}

export function dueLabel(isoDate, { overdueLabel = 'Overdue' } = {}) {
  const n = daysUntil(isoDate)
  if (n == null) return '—'
  if (n < 0) return `${overdueLabel} ${Math.abs(n)}d`
  if (n === 0) return 'Due today'
  if (n <= 14) return `Due in ${n}d`
  return fmtDate(isoDate)
}
